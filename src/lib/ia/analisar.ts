import "server-only";
import { falaDeAnexo } from "../emails/formatos";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vocabulario } from "../frentes";
import { dataHoraBR } from "../textos";
import { despacharPush } from "../push";
import { criarClienteAdmin } from "../supabase/admin";
import { baixarDoDrive } from "../drive";
import { guardarImpressao, textoDoPdf } from "../parecidas";
import { alertasAutomaticos, juntarAlertas } from "./alertas";
import { chamarGemini } from "./gemini";
import { addTexto, lerArquivo, lerLink, limparCorpo, novoConteudo } from "./leitura";
import {
  cabecalhoEntrega,
  esquemaAnalise,
  instrucaoSistema,
  professorDefiniuConceito,
  trajetoria,
  validarResultado,
  type Conceito,
  type RegraChecklist,
  type ResultadoIA,
} from "./regras";

type EntregaCompleta = {
  id: string;
  org_id: string;
  etapa_id: string;
  grupo_id: string;
  origem: "email" | "manual";
  assunto: string;
  enviada_em: string;
  atrasada: boolean;
  status: string;
  comentario: string;
  links: string[];
  etapas: { numero: number; titulo: string; entregaveis: string[]; criterios: string; observacoes_ia: string } | null;
  grupos: { nome: string; tema: string } | null;
  organizacoes: { vocabulario: Vocabulario; conceitos: Record<Conceito, string>; regra_checklist: RegraChecklist; exemplos_devolutiva: string; limite_analises_mes: number | null } | null;
  arquivos_entrega: { caminho: string | null; nome: string; tipo: string; drive_id: string | null; drive_por: string | null }[];
};

/**
 * Analisa uma entrega com a IA e grava o resultado (checklist, conceito,
 * análise interna e rascunho de devolutiva). Usa o cliente da pessoa logada:
 * o banco confere se ela avalia nesta empresa.
 */
export async function analisarEntrega(supabase: SupabaseClient, entregaId: string): Promise<{ conceito: string; modelo: string }> {
  const { data, error } = await supabase
    .from("entregas")
    .select(
      "id, org_id, etapa_id, grupo_id, origem, assunto, enviada_em, atrasada, status, comentario, links, etapas(numero, titulo, entregaveis, criterios, observacoes_ia), grupos(nome, tema), organizacoes(vocabulario, conceitos, regra_checklist, exemplos_devolutiva, limite_analises_mes), arquivos_entrega(caminho, nome, tipo, drive_id, drive_por)",
    )
    .eq("id", entregaId)
    .maybeSingle();
  const e = data as EntregaCompleta | null;
  if (error || !e || !e.etapas || !e.organizacoes) throw new Error("Entrega não encontrada.");
  const v = e.organizacoes.vocabulario;
  const itens = e.etapas.entregaveis;
  if (!itens.length) {
    throw new Error(`Cadastre o checklist (“O que deve ser entregue”) d${/a$/i.test(v.etapa) ? "a" : "o"} ${v.etapa.toLowerCase()} antes de analisar.`);
  }

  // "Segue em anexo" e nenhum arquivo nem link: não adianta analisar (a IA daria RUIM por uma falha de envio).
  if (!e.arquivos_entrega.length && !e.links.length && falaDeAnexo(`${e.assunto ?? ""}\n${e.comentario ?? ""}`)) {
    throw new Error("O e-mail diz que tem anexo, mas nenhum arquivo chegou. Use “Buscar anexos de novo” na entrega ou peça para mandar de novo. A IA não analisou para não dar um conceito injusto.");
  }

  // Espaços do cadastro têm um limite de análises de IA por mês (controle de custo).
  const limite = e.organizacoes.limite_analises_mes;
  if (limite !== null && limite !== undefined) {
    const { data: usadas } = await supabase.rpc("analises_no_mes", { p_org: e.org_id });
    if (Number(usadas ?? 0) >= limite) {
      throw new Error(`Este espaço chegou ao limite de ${limite} análises de IA neste mês. Fale com o Handback para aumentar.`);
    }
  }

  const { error: erroInicio } = await supabase.rpc("iniciar_analise", {
    p_entrega: e.id,
    p_pedido: { itens, criterios: e.etapas.criterios, observacoes: e.etapas.observacoes_ia },
  });
  if (erroInicio) throw new Error(erroInicio.message);

  const inicio = Date.now();
  try {
    // 1) Conteúdo: texto do e-mail (ou comentário), anexos e links.
    const conteudo = novoConteudo();
    addTexto(conteudo, e.origem === "email" ? "CORPO DO E-MAIL" : "COMENTÁRIO", limparCorpo(e.comentario));
    // Para comparar com as outras equipes (entregas parecidas demais).
    const paraComparar: { textos: string[]; arquivos: Uint8Array[] } = { textos: [], arquivos: [] };
    const guardarParaComparar = (dados: Uint8Array, nome: string, tipo: string) => {
      paraComparar.arquivos.push(dados);
      if (/\.pdf$/i.test(nome) || tipo === "application/pdf") paraComparar.textos.push(textoDoPdf(dados));
    };
    for (const a of e.arquivos_entrega) {
      // Arquivo no Google Drive de quem ligou o Drive na turma: busca de lá.
      if (a.drive_id && a.drive_por) {
        const admin = criarClienteAdmin();
        try {
          if (!admin) throw new Error("sem servidor");
          const dados = await baixarDoDrive(admin, a.drive_por, a.drive_id);
          guardarParaComparar(dados, a.nome, a.tipo);
          lerArquivo(conteudo, dados, a.nome, a.tipo);
        } catch (e) {
          conteudo.avisos.push(`Não foi possível abrir o arquivo "${a.nome}" no Google Drive${e instanceof Error ? `: ${e.message}` : "."}`);
        }
        continue;
      }
      const { data: blob, error: erroArq } = a.caminho ? await supabase.storage.from("entregas").download(a.caminho) : { data: null, error: true };
      if (erroArq || !blob) {
        conteudo.avisos.push(`Não foi possível abrir o arquivo "${a.nome}".`);
        continue;
      }
      const dados = new Uint8Array(await blob.arrayBuffer());
      guardarParaComparar(dados, a.nome, a.tipo);
      lerArquivo(conteudo, dados, a.nome, a.tipo);
    }
    for (const l of e.links.slice(0, 10)) await lerLink(conteudo, l);

    // 2) Histórico do grupo nas etapas anteriores e exemplos de estilo.
    const [anteriores, exemplos, correcoes] = await Promise.all([historico(supabase, e), exemplosDeEstilo(supabase, e), correcoesAnteriores(supabase, e)]);

    // 3) IA.
    const sistema = instrucaoSistema({
      vocabulario: v,
      conceitos: e.organizacoes.conceitos,
      regra: e.organizacoes.regra_checklist,
      criterios: e.etapas.criterios,
      observacoes: e.etapas.observacoes_ia,
      exemplos,
      correcoes,
    });
    const cabecalho = cabecalhoEntrega({
      vocabulario: v,
      grupo: e.grupos?.nome ?? "",
      tema: e.grupos?.tema ?? "",
      etapaNumero: e.etapas.numero,
      etapaTitulo: e.etapas.titulo,
      enviadaEm: dataHoraBR(e.enviada_em),
      atrasada: e.atrasada,
      itens,
      historico: anteriores.map((x) => ({ etapa: x.etapa, conceito: x.conceito, justificativa: x.justificativa })),
      lidos: conteudo.lidos,
      avisos: conteudo.avisos,
      textos: conteudo.textos,
    });
    const { resultado, modelo, uso } = await chamarGemini(
      sistema,
      [{ text: cabecalho }, ...conteudo.partes, { text: "<<<FIM>>>\nAvalie seguindo rigorosamente as regras." }],
      esquemaAnalise(),
    );

    // 4) Regras do checklist, evolução e gravação.
    const r = validarResultado(resultado as ResultadoIA, itens, {
      regra: e.organizacoes.regra_checklist,
      professorDefiniu: professorDefiniuConceito(e.etapas.observacoes_ia),
    });
    const traj = trajetoria(
      anteriores.map((x) => x.conceito),
      r.conceito,
    );
    // Alertas: o que o Handback calcula sozinho (não depende da IA) + o que a IA percebeu.
    const alertas = juntarAlertas(
      alertasAutomaticos({ checklist: r.checklist, avisosLeitura: conteudo.avisos, lidos: conteudo.lidos, textos: conteudo.textos }),
      r.alertas,
    );
    const { error: erroGravar } = await supabase.rpc("gravar_analise", {
      p_entrega: e.id,
      p_resultado: {
        modelo,
        tokens_entrada: uso.entrada,
        tokens_saida: uso.saida,
        segundos: Math.round((Date.now() - inicio) / 1000),
        checklist: r.checklist,
        conceito: r.conceito,
        justificativa: r.justificativa,
        analise_interna: r.analiseInterna,
        devolutiva: r.devolutiva,
        evolucao: traj.evolucao,
        jornada: traj.jornada,
        arquivos_lidos: conteudo.lidos,
        avisos_leitura: conteudo.avisos,
        alertas,
      },
    });
    if (erroGravar) throw new Error(erroGravar.message);
    // Impressão digital para o aviso de entregas parecidas (sem o texto do e-mail, que é parecido em todas).
    const adminImp = criarClienteAdmin();
    if (adminImp) {
      const textosArquivos = conteudo.textos.filter((t) => !/^=== (CORPO DO E-MAIL|COMENTÁRIO) ===/.test(t));
      await guardarImpressao(adminImp, { id: e.id, org_id: e.org_id, etapa_id: e.etapa_id, grupo_id: e.grupo_id }, [...textosArquivos, ...paraComparar.textos], paraComparar.arquivos).catch((x) =>
        console.error("[parecidas]", x),
      );
    }
    await despacharPush(criarClienteAdmin()).catch(() => 0);
    return { conceito: r.conceito, modelo };
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : String(erro);
    await supabase.rpc("falhar_analise", { p_entrega: e.id, p_erro: msg.split("\n")[0] });
    throw new Error(msg.split("\n")[0]);
  }
}

/** Conceito (final, revisado) do grupo em cada etapa anterior, em ordem. */
async function historico(supabase: SupabaseClient, e: EntregaCompleta) {
  const { data } = await supabase
    .from("entregas")
    .select("id, etapas(numero, titulo), analises(conceito, justificativa, status)")
    .eq("grupo_id", e.grupo_id)
    .eq("status", "recebida")
    .neq("etapa_id", e.etapa_id);
  type Linha = {
    etapas: { numero: number; titulo: string } | null;
    analises: { conceito: string | null; justificativa: string; status: string } | null;
  };
  return ((data ?? []) as unknown as Linha[])
    .filter((x) => x.etapas && x.etapas.numero < (e.etapas?.numero ?? 0))
    .filter((x) => x.analises && ["pronta", "aprovada"].includes(x.analises.status) && x.analises.conceito && x.analises.conceito !== "PENDENTE")
    .sort((a, b) => a.etapas!.numero - b.etapas!.numero)
    .map((x) => ({
      etapa: `${e.organizacoes!.vocabulario.etapa} ${x.etapas!.numero} (${x.etapas!.titulo})`,
      conceito: x.analises!.conceito as Conceito,
      justificativa: x.analises!.justificativa,
    }));
}

/** Exemplos de estilo: os cadastrados em Ajustes ou as últimas devolutivas aprovadas. */
async function exemplosDeEstilo(supabase: SupabaseClient, e: EntregaCompleta): Promise<string> {
  if (e.organizacoes?.exemplos_devolutiva.trim()) return e.organizacoes.exemplos_devolutiva;
  const { data } = await supabase
    .from("analises")
    .select("devolutiva")
    .eq("org_id", e.org_id)
    .eq("status", "aprovada")
    .order("aprovada_em", { ascending: false })
    .limit(5);
  return (data ?? []).map((d) => d.devolutiva).filter(Boolean).join("\n---\n");
}

/** Últimas vezes em que quem avalia mudou o conceito da IA e explicou o motivo (calibração). */
async function correcoesAnteriores(supabase: SupabaseClient, e: EntregaCompleta) {
  const { data } = await supabase
    .from("analises")
    .select("conceito_ia, conceito, motivo_mudanca")
    .eq("org_id", e.org_id)
    .neq("motivo_mudanca", "")
    .in("status", ["pronta", "aprovada"])
    .order("atualizada_em", { ascending: false })
    .limit(15);
  return (data ?? [])
    .filter((x) => x.conceito_ia && x.conceito && x.conceito_ia !== x.conceito)
    .map((x) => ({ ia: x.conceito_ia as string, final: x.conceito as string, motivo: String(x.motivo_mudanca).slice(0, 300) }));
}

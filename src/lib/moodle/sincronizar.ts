import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decifrarTexto } from "../cripto";
import { emailValido, nomeArquivoSeguro } from "../textos";
import {
  baixarArquivo,
  chamar,
  dataDoMoodle,
  enviosDaTarefa,
  ErroMoodle,
  htmlParaTexto,
  notaDoConceito,
  notasDaTarefa,
  matriculaDe,
  participantes,
  salvarDevolutiva,
  tarefasDoCurso,
  textoParaHtml,
  type Participante,
} from "./cliente";

/** Quantas entregas novas, no máximo, cada busca traz (o resto vem na próxima). */
const POR_BUSCA = 12;
const MAX_ARQUIVOS = 20;

type Conexao = { id: string; site: string; chave: string; usuario: number };
type TurmaMoodle = { id: string; org_id: string; modo: "grupos" | "individual"; moodle_curso: number; moodle_conta: string };

/** Abre a conexão (chave decifrada) que uma turma usa. Só no servidor. */
export async function conexaoPorId(admin: SupabaseClient, contaId: string): Promise<Conexao> {
  const { data } = await admin.from("contas_moodle").select("id, site, token_cifrado, invalida, moodle_usuario").eq("id", contaId).maybeSingle();
  if (!data || data.invalida) throw new ErroMoodle("A ligação com o Moodle expirou ou foi cortada. Ligue de novo em Configurações › Moodle.", true);
  const chave = decifrarTexto(data.token_cifrado);
  if (!chave) throw new ErroMoodle("A ligação com o Moodle precisa ser refeita. Ligue de novo em Configurações › Moodle.", true);
  return { id: data.id, site: data.site, chave, usuario: Number(data.moodle_usuario) };
}

/**
 * Só marca a ligação como cortada se o próprio Moodle confirmar que a chave
 * não vale mais. Um erro passageiro (Moodle lento, fora do ar, uma função
 * recusada) não desliga nada. O motivo fica guardado para mostrar na tela.
 */
async function cortarSeAChaveMorreu(admin: SupabaseClient, contaId: string, e: unknown) {
  if (!(e instanceof ErroMoodle && e.reconectar)) return;
  const { data } = await admin.from("contas_moodle").select("site, token_cifrado, invalida").eq("id", contaId).maybeSingle();
  if (!data || data.invalida) return;
  const chave = decifrarTexto(data.token_cifrado);
  if (chave) {
    try {
      await chamar(data.site, chave, "core_webservice_get_site_info");
      return; // a chave ainda vale
    } catch (x) {
      if (!(x instanceof ErroMoodle && x.reconectar)) return; // não deu para confirmar: não corta
    }
  }
  await admin
    .from("contas_moodle")
    .update({ invalida: true, erro: e.message.slice(0, 500), erro_em: new Date().toISOString() })
    .eq("id", contaId);
}

function ehAluno(p: Participante, professor: number) {
  if (p.roles?.length) return p.roles.some((r) => r.shortname === "student");
  return p.id !== professor;
}

/** Alunos do curso no Moodle (sem professores e tutores). */
export async function alunosDoCurso(c: Conexao, curso: number) {
  return (await participantes(c.site, c.chave, curso)).filter((p) => ehAluno(p, c.usuario));
}

/** Atualiza grupos (ou alunos, no modo individual) e e-mails da turma com o que está no Moodle. */
async function atualizarPessoas(admin: SupabaseClient, t: TurmaMoodle, alunos: Participante[]) {
  type Desejado = { nome: string; membros: number[]; pessoas: { email: string; nome: string; matricula: string }[] };
  const desejados = new Map<string, Desejado>();
  for (const a of alunos) {
    const grupo = t.modo === "grupos" ? a.groups?.[0] : undefined;
    const chave = grupo ? `g:${grupo.id}` : `u:${a.id}`;
    const d = desejados.get(chave) ?? { nome: (grupo?.name ?? a.fullname).trim() || `Aluno ${a.id}`, membros: [], pessoas: [] };
    d.membros.push(a.id);
    const email = (a.email ?? "").trim().toLowerCase();
    if (email && emailValido(email)) d.pessoas.push({ email, nome: a.fullname.trim().slice(0, 200), matricula: matriculaDe(a) });
    desejados.set(chave, d);
  }

  const { data: existentes } = await admin.from("grupos").select("id, nome, moodle_id").eq("turma_id", t.id);
  const porMoodle = new Map((existentes ?? []).filter((g) => g.moodle_id).map((g) => [g.moodle_id as string, g.id as string]));
  const nomes = new Set((existentes ?? []).map((g) => String(g.nome).trim().toLowerCase()));

  const idDoGrupo = new Map<string, string>();
  for (const [chave, d] of desejados) {
    let id = porMoodle.get(chave);
    if (id) {
      await admin.from("grupos").update({ moodle_membros: d.membros, ativo: true }).eq("id", id);
    } else {
      let nome = d.nome.slice(0, 110);
      for (let n = 2; nomes.has(nome.toLowerCase()); n++) nome = `${d.nome.slice(0, 110)} (${n})`;
      nomes.add(nome.toLowerCase());
      id = randomUUID();
      const { error } = await admin
        .from("grupos")
        .insert({ id, org_id: t.org_id, turma_id: t.id, nome, moodle_id: chave, moodle_membros: d.membros });
      if (error) throw new Error(`Não foi possível criar ${nome}: ${error.message}`);
    }
    idDoGrupo.set(chave, id);
  }

  const integrantes = [...desejados].flatMap(([chave, d]) =>
    d.pessoas.map((p) => ({ org_id: t.org_id, turma_id: t.id, grupo_id: idDoGrupo.get(chave)!, email: p.email, nome: p.nome, matricula: p.matricula })),
  );
  if (integrantes.length) {
    await admin.from("integrantes").upsert(integrantes, { onConflict: "turma_id,email", ignoreDuplicates: true });
    // Quem já estava cadastrado sem nome ou sem matrícula ganha o que veio do
    // Moodle; o que o professor digitou nunca é trocado.
    const { data: atuais } = await admin.from("integrantes").select("id, email, nome, matricula").eq("turma_id", t.id);
    const vindos = new Map(integrantes.map((i) => [i.email, i]));
    for (const a of atuais ?? []) {
      const v = vindos.get(a.email);
      if (!v) continue;
      const mudar: Record<string, string> = {};
      if (!a.nome && v.nome) mudar.nome = v.nome;
      if (!a.matricula && v.matricula) mudar.matricula = v.matricula;
      if (Object.keys(mudar).length) await admin.from("integrantes").update(mudar).eq("id", a.id);
    }
  }
  return { grupos: desejados.size, alunos: alunos.length };
}

/** Cria as etapas que faltam a partir das tarefas do Moodle (não mexe no que a pessoa editou). */
async function atualizarTarefas(admin: SupabaseClient, t: TurmaMoodle, c: Conexao) {
  const tarefas = (await tarefasDoCurso(c.site, c.chave, t.moodle_curso)).sort(
    (a, b) => (a.duedate || Number.MAX_SAFE_INTEGER) - (b.duedate || Number.MAX_SAFE_INTEGER) || a.id - b.id,
  );
  const { data: etapas } = await admin.from("etapas").select("id, numero, moodle_tarefa").eq("turma_id", t.id);
  const porTarefa = new Map((etapas ?? []).filter((e) => e.moodle_tarefa).map((e) => [Number(e.moodle_tarefa), e.id as string]));
  let numero = Math.max(0, ...(etapas ?? []).map((e) => Number(e.numero)));
  for (const tarefa of tarefas) {
    const emGrupo = Boolean(tarefa.teamsubmission);
    const notaMax = tarefa.grade && tarefa.grade > 0 ? tarefa.grade : null;
    const existente = porTarefa.get(tarefa.id);
    if (existente) {
      await admin.from("etapas").update({ moodle_em_grupo: emGrupo, moodle_nota_max: notaMax }).eq("id", existente);
      continue;
    }
    const ate = dataDoMoodle(tarefa.duedate);
    let de = dataDoMoodle(tarefa.allowsubmissionsfromdate);
    if (de && ate && de > ate) de = null;
    const titulo = tarefa.name.trim().slice(0, 200);
    const { error } = await admin.from("etapas").insert({
      org_id: t.org_id,
      turma_id: t.id,
      numero: ++numero,
      titulo: titulo.length >= 2 ? titulo : `Tarefa ${tarefa.id}`,
      data: ate,
      recebe_de: de,
      recebe_ate: ate,
      criterios: htmlParaTexto(tarefa.intro ?? "").slice(0, 5000),
      moodle_tarefa: tarefa.id,
      moodle_em_grupo: emGrupo,
      moodle_nota_max: notaMax,
    });
    if (error && error.code !== "23505") throw new Error(`Não foi possível criar a tarefa ${titulo}: ${error.message}`);
  }
  return { tarefas: tarefas.length };
}

/** Busca no Moodle os envios novos das tarefas marcadas e grava como entregas (com os arquivos). */
async function trazerEntregas(admin: SupabaseClient, t: TurmaMoodle, c: Conexao, alunos: Participante[]) {
  const [{ data: etapas }, { data: grupos }] = await Promise.all([
    admin.from("etapas").select("id, titulo, moodle_tarefa").eq("turma_id", t.id).eq("moodle_corrigir", true).not("moodle_tarefa", "is", null),
    admin.from("grupos").select("id, moodle_id, moodle_membros").eq("turma_id", t.id).not("moodle_id", "is", null),
  ]);
  const porMoodle = new Map((grupos ?? []).map((g) => [g.moodle_id as string, g.id as string]));
  const porAluno = new Map<number, string>();
  for (const g of grupos ?? []) for (const m of (g.moodle_membros as number[]) ?? []) porAluno.set(Number(m), g.id);
  const quem = new Map(alunos.map((a) => [a.id, a]));

  let novas = 0;
  let faltam = 0;
  const avisos: string[] = [];
  for (const etapa of etapas ?? []) {
    const envios = (await enviosDaTarefa(c.site, c.chave, Number(etapa.moodle_tarefa)))
      .filter((s) => s.status === "submitted")
      .sort((a, b) => a.timemodified - b.timemodified);
    if (!envios.length) continue;
    const { data: ja } = await admin.from("entregas").select("moodle_chave").eq("etapa_id", etapa.id).not("moodle_chave", "is", null);
    const jaTem = new Set((ja ?? []).map((x) => x.moodle_chave as string));

    for (const s of envios) {
      const chaveEnvio = `${s.id}:${s.timemodified}`;
      if (jaTem.has(chaveEnvio)) continue;
      const grupoId = s.userid
        ? (porAluno.get(s.userid) ?? porMoodle.get(`u:${s.userid}`))
        : s.groupid
          ? porMoodle.get(`g:${s.groupid}`)
          : undefined;
      if (!grupoId) continue; // quem não é aluno (ou grupo vazio do Moodle)
      if (novas >= POR_BUSCA) {
        faltam++;
        continue;
      }

      const arquivos = (s.plugins ?? [])
        .filter((p) => p.type === "file")
        .flatMap((p) => (p.fileareas ?? []).flatMap((a) => a.files ?? []))
        .slice(0, MAX_ARQUIVOS);
      const texto = (s.plugins ?? [])
        .filter((p) => p.type === "onlinetext")
        .flatMap((p) => (p.editorfields ?? []).map((f) => htmlParaTexto(f.text ?? "")))
        .filter(Boolean)
        .join("\n\n");
      if (!arquivos.length && !texto) continue;

      const id = randomUUID();
      const guardados: { caminho: string; nome: string; tamanho: number; tipo: string }[] = [];
      for (const [i, a] of arquivos.entries()) {
        try {
          const dados = await baixarArquivo(c.site, c.chave, a.fileurl);
          const caminho = `${t.org_id}/moodle/${id}/${i + 1}-${nomeArquivoSeguro(a.filename)}`;
          const { error } = await admin.storage.from("entregas").upload(caminho, dados, { contentType: a.mimetype || "application/octet-stream", upsert: false });
          if (error) throw new Error(error.message);
          guardados.push({ caminho, nome: a.filename, tamanho: dados.length, tipo: a.mimetype ?? "" });
        } catch (e) {
          avisos.push(`Não deu para trazer o arquivo “${a.filename}”: ${e instanceof Error ? e.message : e}`);
        }
      }
      const aluno = s.userid ? quem.get(s.userid) : undefined;
      const { error } = await admin.rpc("gravar_entrega_moodle", {
        p_id: id,
        p_org: t.org_id,
        p_etapa: etapa.id,
        p_grupo: grupoId,
        p_remetente: (aluno?.email || aluno?.fullname || "").slice(0, 300),
        p_assunto: `Moodle · ${etapa.titulo}`,
        p_enviada_em: new Date(s.timemodified * 1000).toISOString(),
        p_comentario: texto.slice(0, 20000),
        p_links: [],
        p_arquivos: guardados,
        p_chave: chaveEnvio,
      });
      if (error) {
        if (guardados.length) await admin.storage.from("entregas").remove(guardados.map((g) => g.caminho));
        if (error.code === "23505") continue; // outra busca gravou ao mesmo tempo
        throw new Error(`Falha ao gravar a entrega: ${error.message}`);
      }
      jaTem.add(chaveEnvio);
      novas++;
    }
  }
  return { novas, faltam, avisos };
}

export type ResultadoBusca = { novas: number; faltam: number; avisos: string[]; alunos: number; grupos: number; tarefas: number };

/**
 * Traz tudo do Moodle para a turma: alunos/grupos, tarefas e entregas novas.
 * "segundos" evita duas buscas ao mesmo tempo (devolve null se buscou há pouco).
 */
export async function sincronizarTurma(admin: SupabaseClient, turmaId: string, segundos = 20): Promise<ResultadoBusca | null> {
  const desde = new Date(Date.now() - segundos * 1000).toISOString();
  const { data: reservada } = await admin
    .from("turmas")
    .update({ moodle_buscado_em: new Date().toISOString() })
    .eq("id", turmaId)
    .not("moodle_conta", "is", null)
    .or(`moodle_buscado_em.is.null,moodle_buscado_em.lt.${desde}`)
    .select("id, org_id, modo, moodle_curso, moodle_conta")
    .maybeSingle();
  if (!reservada) return null;
  const t = reservada as TurmaMoodle;
  try {
    const c = await conexaoPorId(admin, t.moodle_conta);
    const alunos = await alunosDoCurso(c, t.moodle_curso);
    const pessoas = await atualizarPessoas(admin, t, alunos);
    const tarefas = await atualizarTarefas(admin, t, c);
    const entregas = await trazerEntregas(admin, t, c, alunos);
    await admin.from("turmas").update({ moodle_erro: "" }).eq("id", t.id);
    return { ...entregas, ...pessoas, ...tarefas };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    await admin.from("turmas").update({ moodle_erro: mensagem.slice(0, 500) }).eq("id", t.id);
    await cortarSeAChaveMorreu(admin, t.moodle_conta, e);
    throw e;
  }
}

/**
 * Devolve a devolutiva aprovada na tarefa do Moodle (comentário e, se
 * pedido, a nota do conceito). O banco confere a permissão e evita mandar
 * duas vezes ao mesmo tempo.
 */
export async function devolverNoMoodle(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  entregaId: string,
  comNota: boolean,
): Promise<{ nota: number | null }> {
  const { data, error } = await supabase.rpc("reservar_envio_moodle", { p_entrega: entregaId });
  if (error) throw new ErroMoodle(error.message);
  const r = data as {
    conta: string;
    tarefa: number;
    em_grupo: boolean;
    nota_max: number | null;
    membros: number[];
    devolutiva: string;
    conceito: string | null;
    enviar_conceito: boolean;
    porcentagem: number | null;
  };
  try {
    const c = await conexaoPorId(admin, r.conta);
    const nota = comNota ? notaDoConceito(r.nota_max, r.porcentagem) : null;
    const atuais = nota === null ? await notasDaTarefa(c.site, c.chave, r.tarefa) : null;
    const html = textoParaHtml(r.devolutiva, r.enviar_conceito && r.conceito && r.conceito !== "PENDENTE" ? r.conceito : null);
    const alunos = r.em_grupo ? r.membros.slice(0, 1) : r.membros;
    for (const aluno of alunos) {
      await salvarDevolutiva(c.site, c.chave, {
        tarefa: r.tarefa,
        aluno,
        // Sem nota pedida: mantém a que já está no Moodle.
        nota: nota ?? atuais?.get(aluno) ?? -1,
        comentarioHtml: html,
        todosDoGrupo: r.em_grupo,
      });
    }
    await supabase.rpc("concluir_envio_moodle", { p_entrega: entregaId, p_ok: true, p_nota: nota, p_erro: "" });
    return { nota };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    await supabase.rpc("concluir_envio_moodle", { p_entrega: entregaId, p_ok: false, p_nota: null, p_erro: mensagem });
    await cortarSeAChaveMorreu(admin, r.conta, e);
    throw e;
  }
}

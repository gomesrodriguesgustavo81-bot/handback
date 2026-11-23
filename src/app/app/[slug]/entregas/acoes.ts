"use server";
import { origemDoSite } from "@/lib/acesso";
import { chamarFila } from "@/lib/fila";
import { levarParaODrive } from "@/lib/drive";
import { after } from "next/server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/components/form-acao";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lerLinks } from "@/lib/textos";
import { analisarEntrega } from "@/lib/ia/analisar";
import { iaConfigurada } from "@/lib/ia/gemini";
import { enviarDevolutiva } from "@/lib/envio";
import { decifrar, ErroGmail, revogar } from "@/lib/gmail";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { registrarAcesso } from "@/lib/registro";

export type ArquivoEnviado = { caminho: string; nome: string; tamanho: number; tipo: string };

/**
 * Registra à mão uma entrega que chegou por outro meio (depois que os
 * arquivos já subiram para a área privada). O banco confere tudo de novo.
 */
export async function registrarEntregaManual(
  slug: string,
  dados: { id: string; etapaId: string; grupoId: string; comentario: string; links: string; arquivos: ArquivoEnviado[] },
): Promise<{ ok: boolean; mensagem: string }> {
  const { podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return { ok: false, mensagem: "Você não tem permissão para registrar entregas." };

  const links = lerLinks(dados.links);
  if (links.invalidos.length) {
    return { ok: false, mensagem: `Estes links não parecem válidos (precisam começar com https://): ${links.invalidos.join(", ")}` };
  }
  if (links.validos.length > 20) return { ok: false, mensagem: "No máximo 20 links por entrega." };
  if (dados.comentario.length > 5000) return { ok: false, mensagem: "O comentário pode ter no máximo 5.000 letras." };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .rpc("registrar_entrega_manual", {
      p_id: dados.id,
      p_etapa: dados.etapaId,
      p_grupo: dados.grupoId,
      p_comentario: dados.comentario,
      p_links: links.validos,
      p_arquivos: dados.arquivos,
    })
    .single<{ atrasada: boolean }>();
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível registrar a entrega. Tente de novo.") };

  // Turma com o Drive ligado: os arquivos vão para lá logo depois.
  if (dados.arquivos.length) {
    after(async () => {
      const admin = criarClienteAdmin();
      if (admin) await levarParaODrive(admin, Date.now() + 40_000).catch(() => undefined);
    });
  }
  revalidatePath(`/app/${slug}`, "layout");
  return {
    ok: true,
    mensagem: data.atrasada ? "Entrega registrada (fora do prazo: ficou “com atraso”)." : "Entrega registrada.",
  };
}

/** Confirma um e-mail da caixa como entrega de uma etapa e um grupo. */
export async function importarEmail(slug: string, emailId: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const etapa = String(dados.get("etapa") ?? "");
  const grupo = String(dados.get("grupo") ?? "");
  if (!etapa || !grupo) return { ok: false, mensagem: "Escolha a etapa e o grupo." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("importar_email", { p_email: emailId, p_etapa: etapa, p_grupo: grupo });
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível confirmar. Tente de novo.") };
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: "Confirmado como entrega." };
}

/** Marca um e-mail da caixa como "não é entrega". */
export async function ignorarEmail(slug: string, emailId: string): Promise<void> {
  const { podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return;
  const supabase = await criarClienteServidor();
  await supabase.rpc("ignorar_email", { p_email: emailId });
  revalidatePath(`/app/${slug}`, "layout");
}

/** Analisa uma entrega com a IA (pode levar até 1 ou 2 minutos). */
export async function analisarComIA(slug: string, entregaId: string): Promise<{ ok: boolean; mensagem: string }> {
  const { podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  if (!iaConfigurada()) return { ok: false, mensagem: "A IA ainda não foi configurada no servidor (falta a chave GEMINI_API_KEY)." };
  const supabase = await criarClienteServidor();
  try {
    const r = await analisarEntrega(supabase, entregaId);
    revalidatePath(`/app/${slug}`, "layout");
    return { ok: true, mensagem: `Análise pronta (conceito sugerido: ${r.conceito}).` };
  } catch (erro) {
    revalidatePath(`/app/${slug}`, "layout");
    return { ok: false, mensagem: erro instanceof Error ? erro.message : "A análise falhou. Tente de novo." };
  }
}

/** Salva a revisão (rascunho) ou aprova a devolutiva. */
export async function revisarDevolutiva(slug: string, entregaId: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const aprovar = dados.get("acao") === "aprovar";
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("revisar_devolutiva", {
    p_entrega: entregaId,
    p_conceito: String(dados.get("conceito") ?? ""),
    p_devolutiva: String(dados.get("devolutiva") ?? "").trim(),
    p_aprovar: aprovar,
    p_motivo: String(dados.get("motivo") ?? "").trim().slice(0, 500),
  });
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: aprovar ? "Devolutiva aprovada." : "Rascunho salvo." };
}

export async function reabrirDevolutiva(slug: string, entregaId: string): Promise<void> {
  const { podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return;
  const supabase = await criarClienteServidor();
  await supabase.rpc("reabrir_devolutiva", { p_entrega: entregaId });
  revalidatePath(`/app/${slug}`, "layout");
}

/**
 * Aprova de uma vez as devolutivas prontas (sem edição) de uma etapa.
 * Só entram as que têm conceito e texto; as demais ficam para revisar.
 */
export async function aprovarProntas(slug: string, etapaId: string): Promise<{ ok: boolean; mensagem: string }> {
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("entregas")
    .select("id, analises(status, conceito, devolutiva)")
    .eq("org_id", empresa.id)
    .eq("etapa_id", etapaId)
    .eq("status", "recebida");
  type Linha = { id: string; analises: { status: string; conceito: string | null; devolutiva: string } | null };
  const prontas = ((data ?? []) as unknown as Linha[]).filter(
    (e) => e.analises?.status === "pronta" && e.analises.conceito && e.analises.devolutiva.trim(),
  );
  let feitas = 0;
  for (const e of prontas) {
    const { error } = await supabase.rpc("revisar_devolutiva", {
      p_entrega: e.id,
      p_conceito: e.analises!.conceito,
      p_devolutiva: e.analises!.devolutiva,
      p_aprovar: true,
    });
    if (!error) feitas++;
  }
  revalidatePath(`/app/${slug}`, "layout");
  if (!prontas.length) return { ok: false, mensagem: "Nenhuma devolutiva pronta para aprovar." };
  return feitas === prontas.length
    ? { ok: true, mensagem: `${feitas} devolutiva(s) aprovada(s).` }
    : { ok: false, mensagem: `${feitas} de ${prontas.length} aprovadas. Abra as que faltaram para ver o motivo.` };
}

/** Decide um e-mail da caixa: “É entrega” (com etapa e grupo) ou “Ignorar”. */
export async function decidirEmail(slug: string, emailId: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  if (dados.get("acao") === "ignorar") {
    await ignorarEmail(slug, emailId);
    return { ok: true, mensagem: "E-mail ignorado." };
  }
  return importarEmail(slug, emailId, _a, dados);
}

/** Envia a devolutiva aprovada pelo Gmail de quem está logado. */
export async function enviarDevolutivaPorEmail(
  slug: string,
  entregaId: string,
): Promise<{ ok: boolean; mensagem: string; reconectar?: boolean }> {
  const { podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensagem: "Entre de novo para enviar." };
  try {
    const { para } = await enviarDevolutiva(supabase, user.id, entregaId);
    revalidatePath(`/app/${slug}`, "layout");
    return { ok: true, mensagem: `Enviada para ${para.join(", ")}.` };
  } catch (e) {
    revalidatePath(`/app/${slug}`, "layout");
    return {
      ok: false,
      mensagem: e instanceof Error ? e.message : "Não foi possível enviar. Tente de novo.",
      reconectar: e instanceof ErroGmail && e.reconectar,
    };
  }
}

/** Desconecta o Gmail de quem está logado (e avisa o Google para apagar a permissão). */
export async function desconectarGmail(slug: string): Promise<void> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = criarClienteAdmin();
  if (!user || !admin) return;
  const { data } = await admin.from("contas_gmail").select("token_cifrado").eq("user_id", user.id).maybeSingle();
  if (data) {
    try {
      await revogar(decifrar(data.token_cifrado));
    } catch {
      /* a permissão some do Handback de qualquer jeito */
    }
    await admin.from("contas_gmail").delete().eq("user_id", user.id);
    await registrarAcesso(supabase, "desconectou_gmail");
  }
  revalidatePath(`/app/${slug}`, "layout");
}

/**
 * Põe várias entregas na fila de análise. O servidor analisa em segundo
 * plano: a pessoa pode fechar a página e o sininho avisa quando acabar.
 */
export async function analisarEmSegundoPlano(slug: string, entregaIds: string[]): Promise<{ ok: boolean; mensagem: string }> {
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  if (!iaConfigurada()) return { ok: false, mensagem: "A IA ainda não foi configurada no servidor (falta a chave GEMINI_API_KEY)." };
  const ids = entregaIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500);
  if (!ids.length) return { ok: false, mensagem: "Nenhuma entrega para analisar." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("enfileirar_analises", { p_org: empresa.id, p_entregas: ids });
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível começar. Tente de novo.") };
  const origem = await origemDoSite();
  after(() => chamarFila(origem));
  revalidatePath(`/app/${slug}`, "layout");
  const n = Number(data ?? 0);
  return {
    ok: true,
    mensagem: n
      ? `${n} ${n === 1 ? "entrega entrou" : "entregas entraram"} na fila. Pode fechar a página: o sininho avisa quando ficar pronto.`
      : "Essas entregas já estão na fila.",
  };
}

"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/components/form-acao";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lerLinks } from "@/lib/textos";
import { analisarEntrega } from "@/lib/ia/analisar";
import { iaConfigurada } from "@/lib/ia/gemini";

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

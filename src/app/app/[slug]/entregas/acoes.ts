"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/components/form-acao";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lerLinks } from "@/lib/textos";

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

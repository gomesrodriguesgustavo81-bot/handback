"use server";

import { revalidatePath } from "next/cache";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lerLinks } from "@/lib/textos";

export type ArquivoEnviado = { caminho: string; nome: string; tamanho: number; tipo: string };

/**
 * Registra a entrega depois que os arquivos já subiram para a área privada.
 * O banco confere tudo de novo (quem pode entregar, pasta dos arquivos, prazo).
 */
export async function registrarEntrega(
  slug: string,
  dados: { id: string; etapaId: string; grupoId: string; comentario: string; links: string; arquivos: ArquivoEnviado[] },
): Promise<{ ok: boolean; mensagem: string; atrasada?: boolean }> {
  const { podeAvaliar, souIntegrante } = await contextoDaEmpresa(slug);
  if (!podeAvaliar && !souIntegrante) return { ok: false, mensagem: "Você não tem permissão para entregar aqui." };

  const links = lerLinks(dados.links);
  if (links.invalidos.length) {
    return { ok: false, mensagem: `Estes links não parecem válidos (precisam começar com https://): ${links.invalidos.join(", ")}` };
  }
  if (links.validos.length > 20) return { ok: false, mensagem: "No máximo 20 links por entrega." };
  if (dados.comentario.length > 5000) return { ok: false, mensagem: "O comentário pode ter no máximo 5.000 letras." };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .rpc("registrar_entrega", {
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
    atrasada: data.atrasada,
    mensagem: data.atrasada
      ? "Entrega recebida, mas fora do prazo: ela ficou marcada como “com atraso”."
      : "Entrega recebida! Quem avalia já pode ver.",
  };
}

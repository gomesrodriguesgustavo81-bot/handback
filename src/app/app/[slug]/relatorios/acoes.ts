"use server";

import { revalidatePath } from "next/cache";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";

/** Liga/desliga a média final da turma aberta, ou muda o peso de uma etapa. */
export async function salvarMedia(slug: string, campo: string, valor: string): Promise<{ ok: boolean; mensagem: string }> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra pode mudar isso." };
  const turma = await turmaAtual(empresa.id);
  if (!turma) return { ok: false, mensagem: "Crie uma turma antes." };
  const supabase = await criarClienteServidor();
  if (campo === "media_ativa") {
    const { error } = await supabase.from("turmas").update({ media_ativa: valor === "sim" }).eq("id", turma.id).eq("org_id", empresa.id);
    if (error) return { ok: false, mensagem: "Não foi possível salvar. Tente de novo." };
  } else if (campo.startsWith("peso_")) {
    const id = campo.slice(5);
    const peso = Number(valor.replace(",", "."));
    if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isFinite(peso) || peso < 0 || peso > 10) return { ok: false, mensagem: "Use um peso de 0 a 10." };
    const { data, error } = await supabase.from("etapas").update({ peso: Math.round(peso * 10) / 10 }).eq("id", id).eq("turma_id", turma.id).select("id");
    if (error || !data?.length) return { ok: false, mensagem: "Não foi possível salvar. Tente de novo." };
  } else return { ok: false, mensagem: "Campo desconhecido." };
  revalidatePath(`/app/${slug}/relatorios`, "layout");
  return { ok: true, mensagem: "Salvo." };
}

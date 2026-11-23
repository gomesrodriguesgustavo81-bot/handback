"use server";

import { revalidatePath } from "next/cache";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";

const CAMPOS = ["lembrete_abre", "lembrete_dois_dias", "lembrete_no_dia"] as const;

/** Liga ou desliga um lembrete da turma aberta. Quem liga passa a ser de quem o Gmail envia, se ainda não houver ninguém. */
export async function salvarLembrete(slug: string, campo: string, valor: string): Promise<{ ok: boolean; mensagem: string }> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra pode mudar isso." };
  const turma = await turmaAtual(empresa.id);
  if (!turma) return { ok: false, mensagem: "Crie uma turma antes." };
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const mudanca: Record<string, unknown> = {};
  if ((CAMPOS as readonly string[]).includes(campo)) {
    mudanca[campo] = valor === "sim";
    const { data: t } = await supabase.from("turmas").select("lembrete_por").eq("id", turma.id).single();
    if (valor === "sim" && !t?.lembrete_por) mudanca.lembrete_por = user?.id;
  } else if (campo === "usar_meu_gmail") {
    mudanca.lembrete_por = user?.id;
  } else return { ok: false, mensagem: "Campo desconhecido." };
  const { data, error } = await supabase.from("turmas").update(mudanca).eq("id", turma.id).eq("org_id", empresa.id).select("id");
  if (error || !data?.length) return { ok: false, mensagem: "Não foi possível salvar. Tente de novo." };
  revalidatePath(`/app/${slug}/configuracoes/lembretes`);
  return { ok: true, mensagem: "Salvo." };
}

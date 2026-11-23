"use server";

import { criarClienteServidor } from "@/lib/supabase/server";

/** Marca um aviso (ou todos) como lido. O banco só deixa mexer nos da própria pessoa. */
export async function marcarLido(id: number | "todos"): Promise<void> {
  const supabase = await criarClienteServidor();
  const agora = new Date().toISOString();
  const q = supabase.from("avisos").update({ lido_em: agora }).is("lido_em", null);
  await (id === "todos" ? q.not("id", "is", null) : q.eq("id", Number(id)));
}

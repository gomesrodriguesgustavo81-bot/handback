import "server-only";
import { criarClienteServidor } from "./supabase/server";

export type Aviso = { id: number; tipo: string; titulo: string; texto: string; link: string; criado_em: string; lido: boolean };

/** Os últimos avisos de quem está logado (o banco só mostra os da própria pessoa). */
export async function meusAvisos(): Promise<{ itens: Aviso[]; novos: number }> {
  const supabase = await criarClienteServidor();
  const [{ data }, { count }] = await Promise.all([
    supabase.from("avisos").select("id, tipo, titulo, texto, link, criado_em, lido_em").order("id", { ascending: false }).limit(30),
    supabase.from("avisos").select("id", { count: "exact", head: true }).is("lido_em", null),
  ]);
  return {
    itens: (data ?? []).map((a) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo, texto: a.texto, link: a.link, criado_em: a.criado_em, lido: Boolean(a.lido_em) })),
    novos: count ?? 0,
  };
}

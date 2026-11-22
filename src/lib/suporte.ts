import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AcessoSuporte = { tipo: "suporte" | "emergencia"; fim: string; motivo: string };

/** Acesso do Handback a um espaço que está valendo agora (suporte liberado pelo cliente ou emergência). */
export async function acessoAtivo(supabase: SupabaseClient, orgId: string): Promise<AcessoSuporte | null> {
  const agora = new Date().toISOString();
  const { data } = await supabase
    .from("acessos_suporte")
    .select("tipo, fim, motivo")
    .eq("org_id", orgId)
    .is("encerrado_em", null)
    .lte("inicio", agora)
    .gt("fim", agora)
    .order("fim", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as AcessoSuporte | null) ?? null;
}

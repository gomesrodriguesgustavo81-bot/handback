import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { COLUNAS_ESCOLHAS, resolverEscolhas, type EscolhasIA, type LinhaEscolhas } from "./escolhas";

/** As escolhas valendo para uma turma (a da turma, senão a da conta), lidas com as regras de acesso de quem está logado. */
export async function carregarEscolhas(supabase: SupabaseClient, orgId: string, turmaId: string | null): Promise<EscolhasIA> {
  const [{ data: conta }, { data: turma }] = await Promise.all([
    supabase.from("organizacoes").select(COLUNAS_ESCOLHAS).eq("id", orgId).maybeSingle(),
    turmaId ? supabase.from("turmas").select(COLUNAS_ESCOLHAS).eq("id", turmaId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return resolverEscolhas(conta as LinhaEscolhas | null, turma as LinhaEscolhas | null);
}

/** Turma de uma etapa (as escolhas são por turma). */
export async function turmaDaEtapa(supabase: SupabaseClient, etapaId: string): Promise<string | null> {
  const { data } = await supabase.from("etapas").select("turma_id").eq("id", etapaId).maybeSingle();
  return (data?.turma_id as string | null | undefined) ?? null;
}

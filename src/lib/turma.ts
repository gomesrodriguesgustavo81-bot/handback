import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Modo } from "./nomes";
import { criarClienteServidor } from "./supabase/server";

export type Turma = { id: string; nome: string; modo: Modo; caixa_token: string; arquivada: boolean };

export function cookieDaTurma(orgId: string) {
  return `hb_turma_${orgId.replace(/-/g, "")}`;
}

/** Turmas da conta (as arquivadas por último). */
export const turmasDaEmpresa = cache(async (orgId: string): Promise<Turma[]> => {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("turmas")
    .select("id, nome, modo, caixa_token, arquivada")
    .eq("org_id", orgId)
    .order("arquivada")
    .order("criada_em");
  return (data ?? []) as Turma[];
});

/** Turma escolhida no topo (guardada no navegador); sem escolha, a primeira ativa. */
export const turmaAtual = cache(async (orgId: string): Promise<Turma | null> => {
  const lista = await turmasDaEmpresa(orgId);
  const escolhida = (await cookies()).get(cookieDaTurma(orgId))?.value;
  return lista.find((t) => t.id === escolhida && !t.arquivada) ?? lista.find((t) => !t.arquivada) ?? lista[0] ?? null;
});

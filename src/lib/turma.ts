import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Modo } from "./nomes";
import { criarClienteServidor } from "./supabase/server";

export type Turma = {
  id: string;
  nome: string;
  modo: Modo;
  caixa_token: string;
  arquivada: boolean;
  /** Ligada a uma disciplina do Moodle (id da conexão), ou null. */
  moodle_conta: string | null;
  moodle_curso_nome: string;
  moodle_buscado_em: string | null;
  moodle_erro: string;
  /** Ligada a uma turma do Google Classroom (id da turma lá), ou null. */
  classroom_curso: string | null;
  classroom_curso_nome: string;
  classroom_por: string | null;
  classroom_buscado_em: string | null;
  classroom_erro: string;
};

export function cookieDaTurma(orgId: string) {
  return `hb_turma_${orgId.replace(/-/g, "")}`;
}

/** Turmas da conta (as arquivadas por último). */
export const turmasDaEmpresa = cache(async (orgId: string): Promise<Turma[]> => {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("turmas")
    .select(
      "id, nome, modo, caixa_token, arquivada, moodle_conta, moodle_curso_nome, moodle_buscado_em, moodle_erro, classroom_curso, classroom_curso_nome, classroom_por, classroom_buscado_em, classroom_erro",
    )
    .eq("org_id", orgId)
    .order("arquivada")
    .order("criada_em");
  if (!error) return (data ?? []) as Turma[];
  const semClassroom = { classroom_curso: null, classroom_curso_nome: "", classroom_por: null, classroom_buscado_em: null, classroom_erro: "" };
  // Banco ainda sem a ligação com o Classroom: segue com o Moodle.
  const { data: comMoodle, error: e2 } = await supabase
    .from("turmas")
    .select("id, nome, modo, caixa_token, arquivada, moodle_conta, moodle_curso_nome, moodle_buscado_em, moodle_erro")
    .eq("org_id", orgId)
    .order("arquivada")
    .order("criada_em");
  if (!e2) return (comMoodle ?? []).map((t) => ({ ...t, ...semClassroom })) as Turma[];
  // Banco ainda sem a ligação com o Moodle: segue funcionando sem ela.
  const { data: antigas } = await supabase
    .from("turmas")
    .select("id, nome, modo, caixa_token, arquivada")
    .eq("org_id", orgId)
    .order("arquivada")
    .order("criada_em");
  return (antigas ?? []).map((t) => ({ ...t, moodle_conta: null, moodle_curso_nome: "", moodle_buscado_em: null, moodle_erro: "", ...semClassroom })) as Turma[];
});

/** Turma escolhida no topo (guardada no navegador); sem escolha, a primeira ativa. */
export const turmaAtual = cache(async (orgId: string): Promise<Turma | null> => {
  const lista = await turmasDaEmpresa(orgId);
  const escolhida = (await cookies()).get(cookieDaTurma(orgId))?.value;
  return lista.find((t) => t.id === escolhida && !t.arquivada) ?? lista.find((t) => !t.arquivada) ?? lista[0] ?? null;
});

import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { origemDoSite } from "./acesso";
import { chamarFila } from "./fila";
import { sincronizarClassroom } from "./classroom/sincronizar";
import { sincronizarTurma } from "./moodle/sincronizar";

/**
 * Piloto automático: nas turmas com ele ligado, o que chegou e ainda não tem
 * análise entra na fila da IA. Devolve quantas entraram.
 */
export async function rodarPiloto(admin: SupabaseClient, origem: string | null): Promise<number> {
  const { data, error } = await admin.rpc("piloto_varrer");
  if (error) {
    console.error("[piloto]", error.message);
    return 0;
  }
  const n = Number(data ?? 0);
  if (n && origem) await chamarFila(origem);
  return n;
}

/** Roda o piloto depois de responder (para ações e páginas que acabaram de trazer entregas). */
export async function pilotoDepois(admin: SupabaseClient): Promise<void> {
  const origem = await origemDoSite();
  after(() => rodarPiloto(admin, origem).catch(() => 0));
}

/** Rodada diária: busca no Moodle e no Classroom as turmas com piloto, sem ninguém abrir o app. */
export async function sincronizarPilotos(admin: SupabaseClient, ate: number): Promise<number> {
  const { data } = await admin.from("turmas").select("id, moodle_conta, classroom_curso").eq("piloto", true).eq("arquivada", false).limit(200);
  let feitas = 0;
  for (const t of data ?? []) {
    if (Date.now() > ate) break;
    try {
      if (t.classroom_curso) await sincronizarClassroom(admin, t.id, 10 * 60);
      else if (t.moodle_conta) await sincronizarTurma(admin, t.id, 10 * 60);
      feitas++;
    } catch {
      // O erro fica gravado na turma (aparece para o professor).
    }
  }
  return feitas;
}

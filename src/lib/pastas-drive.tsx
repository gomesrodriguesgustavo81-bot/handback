import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { linksDasPastas } from "./drive";
import { criarClienteAdmin } from "./supabase/admin";

/** Só quem ligou o Drive na turma tem a pasta no próprio Drive: para os outros, nada. */
async function euEDrive(supabase: SupabaseClient, turmaId: string) {
  const [{ data: eu }, { data: t }] = await Promise.all([supabase.auth.getUser(), supabase.from("turmas").select("drive_por").eq("id", turmaId).maybeSingle()]);
  const id = eu.user?.id;
  return id && t?.drive_por === id ? id : null;
}

/** Link da pasta da equipe no Google Drive (Handback › turma › equipe), se existir para quem está logado. */
export async function pastaDaEquipeNoDrive(supabase: SupabaseClient, grupoId: string): Promise<string | null> {
  const { data: g } = await supabase.from("grupos").select("turma_id").eq("id", grupoId).maybeSingle();
  if (!g) return null;
  const eu = await euEDrive(supabase, g.turma_id);
  const admin = criarClienteAdmin();
  if (!eu || !admin) return null;
  return (await linksDasPastas(admin, eu, [`grupo:${grupoId}`]))[`grupo:${grupoId}`] ?? null;
}

/** Link da pasta da turma no Google Drive, se existir para quem está logado. */
export async function pastaDaTurmaNoDrive(supabase: SupabaseClient, turmaId: string): Promise<string | null> {
  const eu = await euEDrive(supabase, turmaId);
  const admin = criarClienteAdmin();
  if (!eu || !admin) return null;
  return (await linksDasPastas(admin, eu, [`turma:${turmaId}`]))[`turma:${turmaId}`] ?? null;
}

/** Símbolo do Drive (triângulo simples). */
export function IconeDrive() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M8 3h8l6 11-4 7H6l-4-7z M8 3l6 11H2 M16 3l-6 11 M22 14H10l-4 7" />
    </svg>
  );
}

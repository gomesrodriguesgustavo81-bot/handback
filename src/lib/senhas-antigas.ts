import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Senhas antigas de quem administra: guardamos só uma marca (scrypt com sal próprio)
 * das últimas 5, para não repetir. A senha em si nunca é guardada.
 */
export const GUARDAR = 5;

export function marcarSenha(senha: string, sal = randomBytes(16)): string {
  const hash = scryptSync(senha.normalize("NFKC"), sal, 32);
  return `s1$${sal.toString("base64url")}$${hash.toString("base64url")}`;
}

export function conferirMarca(senha: string, marca: string): boolean {
  const [versao, sal, hash] = marca.split("$");
  if (versao !== "s1" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64url");
  const novo = scryptSync(senha.normalize("NFKC"), Buffer.from(sal, "base64url"), esperado.length);
  return novo.length === esperado.length && timingSafeEqual(novo, esperado);
}

/** A senha repete uma das últimas 5? */
export async function senhaJaUsada(admin: SupabaseClient, userId: string, senha: string): Promise<boolean> {
  const { data } = await admin.from("senhas_antigas").select("marca").eq("user_id", userId).order("id", { ascending: false }).limit(GUARDAR);
  return (data ?? []).some((l: { marca: string }) => conferirMarca(senha, l.marca));
}

/** Guarda a marca da senha nova e apaga as mais velhas. */
export async function guardarSenhaNova(admin: SupabaseClient, userId: string, senha: string): Promise<void> {
  await admin.from("senhas_antigas").insert({ user_id: userId, marca: marcarSenha(senha) });
  const { data } = await admin.from("senhas_antigas").select("id").eq("user_id", userId).order("id", { ascending: false });
  const velhas = (data ?? []).slice(GUARDAR).map((l: { id: number }) => l.id);
  if (velhas.length) await admin.from("senhas_antigas").delete().in("id", velhas);
}

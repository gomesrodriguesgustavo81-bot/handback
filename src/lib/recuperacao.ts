import "server-only";
import { createHmac, randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Códigos de recuperação da verificação em duas etapas: 8 códigos de uso único,
 * para quem perde o celular. Guardamos só uma marca de cada (HMAC); eles aparecem
 * inteiros uma única vez, quando são gerados.
 */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O, I, 0, 1
export const QUANTOS = 8;

/** Um código no formato XXXXX-XXXXX (10 letras e números sorteados com segurança). */
export function novoCodigo(): string {
  const letras = Array.from({ length: 10 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
  return `${letras.slice(0, 5)}-${letras.slice(5)}`;
}

/** Aceita minúsculas, espaços e sem o traço. */
export function normalizarCodigo(texto: string): string {
  const limpo = texto.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return limpo.length === 10 ? `${limpo.slice(0, 5)}-${limpo.slice(5)}` : "";
}

function marca(userId: string, codigo: string): string {
  return createHmac("sha256", process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "handback")
    .update(`recuperacao:${userId}:${codigo}`)
    .digest("hex");
}

/** Cria 8 códigos novos (apagando os antigos) e devolve os códigos inteiros, uma única vez. */
export async function gerarCodigos(admin: SupabaseClient, userId: string): Promise<string[]> {
  const codigos = new Set<string>();
  while (codigos.size < QUANTOS) codigos.add(novoCodigo());
  await admin.from("codigos_recuperacao").delete().eq("user_id", userId);
  const lista = [...codigos];
  const { error } = await admin.from("codigos_recuperacao").insert(lista.map((c) => ({ user_id: userId, hash: marca(userId, c) })));
  if (error) throw new Error("Não foi possível guardar os códigos.");
  return lista;
}

/** Usa um código: confere, marca como usado e devolve se valeu. Cada código vale uma vez. */
export async function usarCodigo(admin: SupabaseClient, userId: string, texto: string): Promise<boolean> {
  const codigo = normalizarCodigo(texto);
  if (!codigo) return false;
  const { data } = await admin
    .from("codigos_recuperacao")
    .update({ usado_em: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("hash", marca(userId, codigo))
    .is("usado_em", null)
    .select("id");
  return (data ?? []).length === 1;
}

import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { analisarEntrega } from "./ia/analisar";
import { despacharPush } from "./push";

/**
 * Análises em segundo plano. Cada rodada analisa enquanto há tempo e, se
 * sobrar fila, chama a si mesma de novo (a Vercel limita cada rodada a 60s).
 */
function segredoInterno(): string {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function tokenDaFila(): string {
  const s = segredoInterno();
  return s ? createHmac("sha256", s).update("handback-fila-analises").digest("hex") : "";
}

export function tokenDaFilaValido(cabecalho: string | null): boolean {
  const esperado = `Bearer ${tokenDaFila()}`;
  const veio = cabecalho ?? "";
  return esperado.length > 20 && veio.length === esperado.length && timingSafeEqual(Buffer.from(veio), Buffer.from(esperado));
}

/** Acorda a fila (não espera ela terminar). */
export async function chamarFila(origem: string): Promise<void> {
  const token = tokenDaFila();
  if (!token || !/^https?:\/\//.test(origem)) return;
  await fetch(`${origem.replace(/\/$/, "")}/api/fila`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  }).catch(() => {});
}

const TEMPORARIO = /limite de uso|quota|429|503|ocupad|sobrecarreg|tente de novo|timeout|tempo|indispon|fetch failed|ECONN/i;

export type RodadaFila = { feitas: number; erros: number; restam: number; pausou: boolean };

/** Analisa as entregas da fila, uma de cada vez, até o tempo acabar. */
export async function processarFila(admin: SupabaseClient, ateMs: number): Promise<RodadaFila> {
  const r: RodadaFila = { feitas: 0, erros: 0, restam: 0, pausou: false };
  while (Date.now() < ateMs) {
    const { data, error } = await admin.rpc("pegar_da_fila");
    const item = (data as { entrega_id: string; tentativas: number }[] | null)?.[0];
    if (error || !item) break;
    try {
      await analisarEntrega(admin, item.entrega_id);
      await admin.rpc("concluir_da_fila", { p_entrega: item.entrega_id, p_ok: true, p_erro: "", p_desistir: false });
      r.feitas++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const temporario = TEMPORARIO.test(msg) && item.tentativas < 3;
      await admin.rpc("concluir_da_fila", { p_entrega: item.entrega_id, p_ok: false, p_erro: msg, p_desistir: !temporario });
      if (temporario) {
        // A IA pediu calma: para esta rodada e tenta de novo daqui a pouco.
        r.pausou = true;
        break;
      }
      r.erros++;
    }
  }
  const { count } = await admin.from("fila_analises").select("entrega_id", { count: "exact", head: true }).is("feita_em", null);
  r.restam = count ?? 0;
  // O aviso "N análises prontas" também vai para o celular de quem ligou as notificações.
  if (r.feitas || r.erros) await despacharPush(admin).catch(() => 0);
  return r;
}

/** Tem fila parada (ninguém cuidando)? Usado para acordar a fila quando alguém abre o app. */
export async function filaParada(admin: SupabaseClient): Promise<boolean> {
  const antes = new Date(Date.now() - 90_000).toISOString();
  const travada = new Date(Date.now() - 5 * 60_000).toISOString();
  const { count } = await admin
    .from("fila_analises")
    .select("entrega_id", { count: "exact", head: true })
    .is("feita_em", null)
    .or(`and(comecou_em.is.null,pedida_em.lt.${antes}),comecou_em.lt.${travada}`);
  return Boolean(count);
}

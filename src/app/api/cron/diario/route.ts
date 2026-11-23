import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { urlDoSite } from "@/lib/caminhos";
import { rodarDiario } from "@/lib/diario";
import { chamarFila, filaParada } from "@/lib/fila";
import { sincronizarTodasAsAgendas } from "@/lib/agenda";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { hojeISO } from "@/lib/textos";

export const maxDuration = 60;

/**
 * Rodada diária (9h de Brasília, pela Vercel Cron): lembretes de prazo para
 * os alunos, aviso de prazo amanhã e resumo do dia por e-mail.
 * Só roda com o segredo CRON_SECRET (a Vercel manda sozinha).
 */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET ?? "";
  const veio = request.headers.get("authorization") ?? "";
  const esperado = `Bearer ${segredo}`;
  if (segredo.length < 16 || veio.length !== esperado.length || !timingSafeEqual(Buffer.from(veio), Buffer.from(esperado))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const admin = criarClienteAdmin();
  if (!admin) return NextResponse.json({ ok: false, motivo: "servidor sem configuração" }, { status: 503 });
  const hoje = request.nextUrl.searchParams.get("dia") && process.env.HANDBACK_TESTE_DIA === "1" ? request.nextUrl.searchParams.get("dia")! : hojeISO();
  const site = (process.env.HANDBACK_SITE ?? urlDoSite(request, "/").origin).replace(/\/$/, "");
  const r = await rodarDiario(admin, hoje, site);
  if (await filaParada(admin).catch(() => false)) await chamarFila(site);
  const agendas = await sincronizarTodasAsAgendas(admin, site).catch(() => 0);
  return NextResponse.json({ ok: true, ...r, agendas });
}

import { NextResponse, after, type NextRequest } from "next/server";
import { urlDoSite } from "@/lib/caminhos";
import { chamarFila, processarFila, tokenDaFilaValido } from "@/lib/fila";
import { criarClienteAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;

/** Uma rodada da fila de análises (só o próprio servidor chama). */
export async function POST(request: NextRequest) {
  if (!tokenDaFilaValido(request.headers.get("authorization"))) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = criarClienteAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });
  const origem = urlDoSite(request, "/").origin;
  after(async () => {
    const r = await processarFila(admin, Date.now() + 40_000);
    if (r.restam) {
      if (r.pausou) await new Promise((ok) => setTimeout(ok, 15_000));
      await chamarFila(origem);
    }
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}

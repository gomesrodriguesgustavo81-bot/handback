import { NextResponse, type NextRequest } from "next/server";
import { chavePublicaPush } from "@/lib/push";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";

async function quem() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Chave pública do Handback para o navegador assinar as notificações. */
export async function GET() {
  if (!(await quem())) return NextResponse.json({ erro: "entre de novo" }, { status: 401 });
  const chave = await chavePublicaPush(criarClienteAdmin()!).catch(() => null);
  if (!chave) return NextResponse.json({ erro: "notificações ainda não configuradas no servidor" }, { status: 503 });
  return NextResponse.json({ chave });
}

/** Guarda este aparelho para receber notificações (ou tira, com DELETE). */
export async function POST(request: NextRequest) {
  const user = await quem();
  const admin = criarClienteAdmin();
  if (!user || !admin) return NextResponse.json({ erro: "entre de novo" }, { status: 401 });
  let corpo: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "pedido inválido" }, { status: 400 });
  }
  const endpoint = String(corpo.endpoint ?? "");
  const p256dh = String(corpo.keys?.p256dh ?? "");
  const auth = String(corpo.keys?.auth ?? "");
  if (!/^https:\/\/[^\s]{10,1000}$/.test(endpoint) || !/^[\w-]{20,200}$/.test(p256dh) || !/^[\w-]{8,100}$/.test(auth)) {
    return NextResponse.json({ erro: "pedido inválido" }, { status: 400 });
  }
  const { error } = await admin.from("aparelhos_push").upsert({ user_id: user.id, endpoint, p256dh, auth }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ erro: "não foi possível guardar" }, { status: 500 });
  // Quem ativou num aparelho quer receber no celular.
  const supabase = await criarClienteServidor();
  await supabase.from("preferencias_avisos").upsert({ user_id: user.id, celular: true, atualizado_em: new Date().toISOString() }, { onConflict: "user_id" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await quem();
  const admin = criarClienteAdmin();
  if (!user || !admin) return NextResponse.json({ erro: "entre de novo" }, { status: 401 });
  const endpoint = request.nextUrl.searchParams.get("endpoint") ?? "";
  await admin.from("aparelhos_push").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}

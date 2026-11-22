import { NextResponse, type NextRequest } from "next/server";
import { buscarEmailResend, assinaturaValida } from "@/lib/emails/resend";
import { receberEmail } from "@/lib/emails/receber";
import { criarClienteAdmin } from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * Ponto de chegada dos e-mails recebidos pelo Resend (webhook "email.received").
 * Precisa de RESEND_API_KEY (para buscar o e-mail) e RESEND_WEBHOOK_SECRET
 * (para conferir que a chamada veio mesmo do Resend).
 */
export async function POST(request: NextRequest) {
  const chave = process.env.RESEND_API_KEY;
  const segredo = process.env.RESEND_WEBHOOK_SECRET;
  const admin = criarClienteAdmin();
  if (!chave || !segredo || !admin) {
    return NextResponse.json({ ok: false, motivo: "recebimento pelo Resend não configurado" }, { status: 503 });
  }
  const corpo = await request.text();
  const valido = assinaturaValida(
    segredo,
    {
      id: request.headers.get("svix-id") ?? request.headers.get("webhook-id"),
      timestamp: request.headers.get("svix-timestamp") ?? request.headers.get("webhook-timestamp"),
      assinatura: request.headers.get("svix-signature") ?? request.headers.get("webhook-signature"),
    },
    corpo,
  );
  if (!valido) return NextResponse.json({ ok: false, motivo: "assinatura inválida" }, { status: 401 });

  let evento: Record<string, unknown>;
  try {
    evento = JSON.parse(corpo);
  } catch {
    return NextResponse.json({ ok: false, motivo: "corpo não é JSON" }, { status: 400 });
  }
  // Outros eventos (envio, entrega etc.) não interessam aqui.
  if (evento.type !== "email.received") return NextResponse.json({ ok: true, ignorado: evento.type ?? "?" });

  try {
    const email = await buscarEmailResend(evento, chave);
    const r = await receberEmail(admin, email);
    return NextResponse.json(r, { status: 200 });
  } catch (erro) {
    console.error("[emails/resend]", erro);
    // 500 faz o Resend tentar de novo mais tarde.
    return NextResponse.json({ ok: false, motivo: "erro ao buscar ou gravar o e-mail" }, { status: 500 });
  }
}

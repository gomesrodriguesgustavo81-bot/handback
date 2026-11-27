import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest, after } from "next/server";
import { rodarPiloto } from "@/lib/piloto";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { lerEmailRecebido } from "@/lib/emails/formatos";
import { receberEmail } from "@/lib/emails/receber";
import { despacharPush } from "@/lib/push";
import { levarParaODrive } from "@/lib/drive";

/**
 * Ponto de chegada dos e-mails encaminhados.
 * O serviço de recebimento chama:  POST /api/emails/entrada  com o cabeçalho
 * "Authorization: Bearer SEGREDO" (ou usuário/senha "handback:SEGREDO").
 * O SEGREDO fica na variável HANDBACK_EMAIL_SEGREDO.
 * O segredo na URL (?chave=) fica desligado: endereços aparecem em registros
 * de acesso. Só volta se HANDBACK_EMAIL_CHAVE_NA_URL=sim (para quem ainda não
 * conseguiu trocar a configuração do serviço de recebimento).
 */
export async function POST(request: NextRequest) {
  const segredo = process.env.HANDBACK_EMAIL_SEGREDO;
  const admin = criarClienteAdmin();
  if (!segredo || segredo.length < 16 || !admin) {
    return NextResponse.json({ ok: false, motivo: "recebimento de e-mails não configurado" }, { status: 503 });
  }
  if (!autorizado(request, segredo)) {
    return NextResponse.json({ ok: false, motivo: "não autorizado" }, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, motivo: "corpo não é JSON" }, { status: 400 });
  }
  const email = lerEmailRecebido(corpo);
  if (!email) return NextResponse.json({ ok: false, motivo: "formato de e-mail desconhecido" }, { status: 400 });

  try {
    const r = await receberEmail(admin, email);
    after(() => despacharPush(admin).catch(() => 0));
    const origem = (process.env.HANDBACK_SITE ?? request.nextUrl.origin).replace(/\/$/, "");
    after(() => rodarPiloto(admin, origem).catch(() => 0));
    after(() => levarParaODrive(admin, Date.now() + 40_000).catch(() => undefined));
    // 200 mesmo quando a caixa é desconhecida: o serviço não deve ficar reenviando.
    return NextResponse.json(r, { status: 200 });
  } catch (erro) {
    console.error("[emails/entrada]", erro);
    // 500 faz o serviço tentar de novo mais tarde.
    return NextResponse.json({ ok: false, motivo: "erro ao gravar" }, { status: 500 });
  }
}

function autorizado(request: NextRequest, segredo: string): boolean {
  const candidatos: string[] = [];
  const chave = request.nextUrl.searchParams.get("chave");
  if (chave && process.env.HANDBACK_EMAIL_CHAVE_NA_URL === "sim") candidatos.push(chave);
  const auth = request.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) candidatos.push(auth.slice(7));
  if (auth.startsWith("Basic ")) {
    const [, senha] = Buffer.from(auth.slice(6), "base64").toString().split(":");
    if (senha) candidatos.push(senha);
  }
  const esperado = Buffer.from(segredo);
  return candidatos.some((c) => {
    const b = Buffer.from(c);
    return b.length === esperado.length && timingSafeEqual(b, esperado);
  });
}

import "server-only";
import { createHmac } from "node:crypto";
import { criarClienteAdmin } from "./supabase/admin";

/**
 * Limite de tentativas de entrar: 5 senhas erradas seguidas para o mesmo e-mail
 * travam a entrada (1 minuto na 1ª vez, 5 na 2ª, 15 da 3ª em diante, contando 24 horas). Guardamos só uma marca embaralhada do e-mail.
 * Se o banco não responder, não trava ninguém (o limite do Supabase continua valendo).
 */
export const MAX_TENTATIVAS = 5;

function marca(email: string, escopo = "login"): string {
  return createHmac("sha256", process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "handback")
    .update(`${escopo}:${email.trim().toLowerCase()}`)
    .digest("hex");
}

/** Quantos minutos faltam para destravar (0 se a entrada está livre). */
export async function minutosDeTrava(email: string, escopo = "login"): Promise<number> {
  const admin = criarClienteAdmin();
  if (!admin) return 0;
  try {
    const { data } = await admin.rpc("login_bloqueio", { p_hash: marca(email, escopo) });
    return paraMinutos(data);
  } catch {
    return 0;
  }
}

/** Conta uma senha errada. Devolve os minutos de trava, se essa foi a que travou. */
export async function contarSenhaErrada(email: string, escopo = "login"): Promise<number> {
  const admin = criarClienteAdmin();
  if (!admin) return 0;
  try {
    const { data } = await admin.rpc("login_falhou", { p_hash: marca(email, escopo) });
    return paraMinutos(data);
  } catch {
    return 0;
  }
}

/** Entrou: zera a contagem. */
export async function zerarTentativas(email: string, escopo = "login"): Promise<void> {
  const admin = criarClienteAdmin();
  if (!admin) return;
  try {
    await admin.rpc("login_ok", { p_hash: marca(email, escopo) });
  } catch {
    // Sem problema: a contagem vence sozinha.
  }
}

function paraMinutos(ate: unknown): number {
  if (typeof ate !== "string") return 0;
  const falta = new Date(ate).getTime() - Date.now();
  return falta > 0 ? Math.max(1, Math.ceil(falta / 60000)) : 0;
}

export function mensagemDeTrava(minutos: number): string {
  return `Muitas tentativas erradas. Por segurança, a entrada fica travada por mais ${minutos} ${minutos === 1 ? "minuto" : "minutos"}. Se esqueceu a senha, use “Esqueci minha senha”.`;
}

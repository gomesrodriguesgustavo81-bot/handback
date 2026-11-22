import "server-only";
import { headers } from "next/headers";
import { criarClienteAdmin } from "./supabase/admin";

/** Endereço do site como o navegador vê (funciona atrás da Vercel). */
export async function origemDoSite(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${protocolo}://${host}`;
}

/**
 * Manda o e-mail de convite (com o link para criar a senha). Se a pessoa já
 * tem conta, não manda nada: o acesso à empresa nova aparece no próximo login.
 */
export async function convidarPorEmail(email: string, empresa: string, cadastro = false): Promise<"enviado" | "ja-tem-conta" | "erro"> {
  const admin = criarClienteAdmin();
  if (!admin) return "erro";
  const destino = `${await origemDoSite()}/auth/confirmar?voltar=/definir-senha`;
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: destino, data: cadastro ? { empresa, cadastro: true } : { empresa } });
  if (!error) return "enviado";
  if (error.status === 422 || /already been registered|already registered|exists/i.test(error.message)) return "ja-tem-conta";
  console.error("[convite]", error.message);
  return "erro";
}

/** Marca, de um jeito que só o servidor consegue, que a pessoa já criou a senha. */
export async function marcarSenhaDefinida(userId: string): Promise<boolean> {
  const admin = criarClienteAdmin();
  if (!admin) return false;
  const { error } = await admin.auth.admin.updateUserById(userId, { app_metadata: { senha_definida: true } });
  return !error;
}

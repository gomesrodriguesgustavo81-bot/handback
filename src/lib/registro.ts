import "server-only";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { descreverAparelho } from "./aparelho";
import { criarClienteAdmin } from "./supabase/admin";

export type AcaoDeAcesso =
  | "entrou_senha"
  | "entrou_link"
  | "confirmou_codigo"
  | "saiu"
  | "saiu_de_todos"
  | "criou_senha"
  | "ativou_duas_etapas"
  | "trocou_celular"
  | "conectou_gmail"
  | "desconectou_gmail"
  | "conectou_agenda"
  | "desconectou_agenda"
  | "conectou_drive"
  | "desconectou_drive"
  | "conectou_classroom"
  | "desconectou_classroom";

/** IP e aparelho de quem fez o pedido (a Vercel informa o IP real no x-forwarded-for). */
export async function quemEOnde(): Promise<{ ip: string; aparelho: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim();
  return { ip, aparelho: descreverAparelho(h.get("user-agent") ?? "") };
}

/** Registra um acesso ou mudança de segurança da própria conta. Nunca derruba a tela se falhar. */
export async function registrarAcesso(supabase: SupabaseClient, acao: AcaoDeAcesso): Promise<void> {
  try {
    const { ip, aparelho } = await quemEOnde();
    await supabase.rpc("registrar_acesso", { p_acao: acao, p_ip: ip, p_aparelho: aparelho });
  } catch (e) {
    console.error("[registro]", e);
  }
}

export async function registrarDocumento(
  supabase: SupabaseClient,
  org: string,
  acao: "abriu_entrega" | "baixou_arquivo" | "abriu_relatorio",
  descricao: string,
  alvo: string | null,
): Promise<void> {
  try {
    const { ip, aparelho } = await quemEOnde();
    await supabase.rpc("registrar_documento", { p_org: org, p_acao: acao, p_descricao: descricao, p_alvo: alvo, p_ip: ip, p_aparelho: aparelho });
  } catch (e) {
    console.error("[registro]", e);
  }
}

/** Tentativa com senha errada (gravada pelo servidor com a chave secreta). */
export async function registrarFalhaLogin(email: string): Promise<void> {
  const admin = criarClienteAdmin();
  if (!admin) return;
  try {
    const { ip, aparelho } = await quemEOnde();
    await admin.rpc("registrar_falha_login", { p_email: email, p_ip: ip, p_aparelho: aparelho });
  } catch (e) {
    console.error("[registro]", e);
  }
}

import "server-only";
import { cifrarTexto, criptoPronta, decifrarTexto } from "./cripto";

/**
 * Conexão com o Gmail de quem avalia, só com permissão de ENVIAR
 * (gmail.send). O Handback nunca lê a caixa de ninguém.
 *
 * Variáveis no servidor: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.
 * O token guardado no banco é cifrado com HANDBACK_CRIPTO_CHAVE (ou, se ela
 * não existir, com uma chave derivada da chave secreta do Supabase).
 * HANDBACK_GOOGLE_BASE troca os endereços do Google (só para testes).
 */
export const ESCOPO_ENVIO = "https://www.googleapis.com/auth/gmail.send";
const ESCOPOS = ["openid", "email", ESCOPO_ENVIO].join(" ");

function enderecos() {
  const base = process.env.HANDBACK_GOOGLE_BASE?.replace(/\/$/, "");
  return {
    autorizar: base ? `${base}/o/oauth2/v2/auth` : "https://accounts.google.com/o/oauth2/v2/auth",
    token: base ? `${base}/token` : "https://oauth2.googleapis.com/token",
    revogar: base ? `${base}/revoke` : "https://oauth2.googleapis.com/revoke",
    enviar: base ? `${base}/gmail/v1/users/me/messages/send` : "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
  };
}

export class ErroGmail extends Error {
  constructor(
    mensagem: string,
    public reconectar = false,
  ) {
    super(mensagem);
  }
}

export function gmailConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && criptoPronta());
}

export function urlDeAutorizacao(redirectUri: string, estado: string, dica?: string): string {
  const u = new URL(enderecos().autorizar);
  u.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID ?? "");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", ESCOPOS);
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", estado);
  if (dica) u.searchParams.set("login_hint", dica);
  return u.toString();
}

async function pedirToken(corpo: Record<string, string>) {
  const r = await fetch(enderecos().token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...corpo,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = (await r.json().catch(() => ({}))) as Record<string, string>;
  if (!r.ok) {
    if (j.error === "invalid_grant") throw new ErroGmail("A conexão com o Gmail expirou ou foi removida. Conecte de novo.", true);
    throw new ErroGmail(`O Google recusou (${j.error_description ?? j.error ?? r.status}).`);
  }
  return j;
}

/** Troca o código da autorização pelo token. Devolve o e-mail da conta e o token de renovação. */
export async function trocarCodigo(codigo: string, redirectUri: string): Promise<{ email: string; renovacao: string }> {
  const j = await pedirToken({ code: codigo, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!String(j.scope ?? "").split(" ").includes(ESCOPO_ENVIO)) {
    throw new ErroGmail("Sem a permissão de enviar e-mails. Conecte de novo e marque a opção de enviar e-mails.");
  }
  if (!j.refresh_token) throw new ErroGmail("O Google não devolveu a autorização completa. Tente conectar de novo.");
  // O id_token veio direto do Google (pela conexão segura): só lemos o e-mail dele.
  let email = "";
  try {
    const carga = JSON.parse(Buffer.from(String(j.id_token).split(".")[1], "base64url").toString("utf8"));
    if (carga.email_verified !== false) email = String(carga.email ?? "").toLowerCase();
  } catch {
    /* sem e-mail */
  }
  if (!email) throw new ErroGmail("Não foi possível saber qual Gmail foi conectado. Tente de novo.");
  return { email, renovacao: j.refresh_token };
}

export async function tokenDeAcesso(renovacao: string): Promise<string> {
  const j = await pedirToken({ refresh_token: renovacao, grant_type: "refresh_token" });
  return j.access_token;
}

/** Envia uma mensagem já montada (base64url). Devolve o id da mensagem no Gmail. */
export async function enviarPeloGmail(acesso: string, raw: string): Promise<string> {
  const r = await fetch(enderecos().enviar, {
    method: "POST",
    headers: { authorization: `Bearer ${acesso}`, "content-type": "application/json" },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(30_000),
  });
  const j = (await r.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (r.status === 401 || r.status === 403) {
    throw new ErroGmail("O Gmail não aceitou o envio por esta conexão. Conecte o Gmail de novo.", true);
  }
  if (!r.ok || !j.id) throw new ErroGmail(`O Gmail não enviou (${j.error?.message ?? r.status}).`);
  return j.id;
}

export async function revogar(renovacao: string): Promise<void> {
  await fetch(enderecos().revogar, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: renovacao }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------
// Cifra do token (AES-256-GCM, em ./cripto)
// ---------------------------------------------------------------------
export function cifrar(texto: string): string {
  if (!criptoPronta()) throw new ErroGmail("Falta a chave para guardar a conexão no servidor.");
  return cifrarTexto(texto);
}

export function decifrar(guardado: string): string {
  const t = decifrarTexto(guardado);
  if (t === null) throw new ErroGmail("A conexão com o Gmail precisa ser refeita.", true);
  return t;
}

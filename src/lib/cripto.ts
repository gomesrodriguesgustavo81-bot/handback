import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Cifra das chaves de acesso guardadas no banco (Gmail, Moodle), com
 * AES-256-GCM. A chave vem de HANDBACK_CRIPTO_CHAVE ou, se ela não existir,
 * é derivada da chave secreta do Supabase.
 */
function chave(): Buffer | null {
  const propria = process.env.HANDBACK_CRIPTO_CHAVE;
  if (propria) {
    const b = Buffer.from(propria, "base64");
    if (b.length === 32) return b;
  }
  const segredo = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo) return null;
  return Buffer.from(hkdfSync("sha256", segredo, "handback", "token-gmail", 32));
}

export function criptoPronta(): boolean {
  return chave() !== null;
}

export function cifrarTexto(texto: string): string {
  const k = chave();
  if (!k) throw new Error("Falta a chave para guardar a conexão no servidor.");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), dados.toString("base64")].join(".");
}

/** Devolve null se não der para decifrar (chave trocada ou dado estragado). */
export function decifrarTexto(guardado: string): string | null {
  const k = chave();
  const [v, iv, tag, dados] = guardado.split(".");
  if (!k || v !== "v1") return null;
  try {
    const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(dados, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

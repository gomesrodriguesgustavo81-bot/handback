import { createHash } from "node:crypto";

/** Regras de senha do Handback (o Supabase também confere tamanho e letras+números). */
export const TAMANHO_MINIMO = 12;

const COMUNS = ["123456", "senha", "password", "qwerty", "handback", "abc123", "111111", "000000", "brasil"];

/** Devolve o motivo de a senha ser fraca, ou null se estiver boa. */
export function problemaNaSenha(senha: string, email: string): string | null {
  if (senha.length < TAMANHO_MINIMO) return `A senha precisa ter pelo menos ${TAMANHO_MINIMO} caracteres.`;
  if (senha.length > 128) return "A senha pode ter no máximo 128 caracteres.";
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return "Use letras e números na senha.";
  if (/^(.)\1+$/.test(senha.replace(/\d/g, "")) && /^(.)\1+$/.test(senha.replace(/\D/g, ""))) {
    return "A senha é muito repetitiva.";
  }
  const minus = senha.toLowerCase();
  const usuario = email.split("@")[0]?.toLowerCase() ?? "";
  if (usuario.length >= 4 && minus.includes(usuario)) return "A senha não pode conter o seu e-mail.";
  if (COMUNS.some((c) => minus.includes(c) && minus.replace(c, "").replace(/\d/g, "").length < 4)) {
    return "Essa senha é muito comum. Escolha outra.";
  }
  return null;
}

/**
 * A senha aparece em vazamentos conhecidos? Consulta a base pública
 * "Have I Been Pwned" pelo método anônimo: só os 5 primeiros caracteres do
 * resumo SHA-1 saem do servidor; a senha nunca é enviada.
 * Se a consulta falhar, não bloqueia (as outras regras continuam valendo).
 */
export async function senhaVazada(senha: string, buscar: typeof fetch = fetch): Promise<boolean> {
  const resumo = createHash("sha1").update(senha, "utf8").digest("hex").toUpperCase();
  const prefixo = resumo.slice(0, 5);
  const resto = resumo.slice(5);
  try {
    const r = await buscar(`https://api.pwnedpasswords.com/range/${prefixo}`, {
      headers: { "add-padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return false;
    const corpo = await r.text();
    return corpo.split("\n").some((linha) => {
      const [sufixo, vezes] = linha.trim().split(":");
      return sufixo === resto && Number(vezes) > 0;
    });
  } catch {
    return false;
  }
}

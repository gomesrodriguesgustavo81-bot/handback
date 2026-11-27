import { createHash } from "node:crypto";

export { problemaNaSenha, TAMANHO_MINIMO } from "./senha-regras";

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

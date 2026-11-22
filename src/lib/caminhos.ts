/**
 * Aceita só caminhos internos (começando por uma barra), para que um link de
 * login nunca leve a pessoa para outro site.
 */
export function caminhoSeguro(valor: unknown, padrao = "/app"): string {
  if (typeof valor !== "string") return padrao;
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.startsWith("/\\")) return padrao;
  return valor;
}

/** Transforma um nome em endereço: "Escola Alfa" → "escola-alfa". */
export function gerarSlug(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * Monta um endereço completo do próprio site a partir do pedido recebido,
 * usando o host que o navegador realmente usou (atrás da Vercel, vem em
 * x-forwarded-host).
 */
export function urlDoSite(request: { headers: Headers; nextUrl: URL }, caminho: string): URL {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const protocolo = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return new URL(caminho, `${protocolo}://${host}`);
}

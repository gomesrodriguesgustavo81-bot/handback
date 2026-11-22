/** "Chrome no Windows", "Safari no iPhone"… a partir do User-Agent do navegador. */
export function descreverAparelho(ua: string): string {
  const u = ua || "";
  const navegador = /Edg\//.test(u)
    ? "Edge"
    : /OPR\/|Opera/.test(u)
      ? "Opera"
      : /SamsungBrowser/.test(u)
        ? "Samsung Internet"
        : /Firefox\//.test(u)
          ? "Firefox"
          : /Chrome\//.test(u)
            ? "Chrome"
            : /Safari\//.test(u)
              ? "Safari"
              : "Navegador";
  const sistema = /iPhone/.test(u)
    ? "iPhone"
    : /iPad/.test(u)
      ? "iPad"
      : /Android/.test(u)
        ? "Android"
        : /Windows/.test(u)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(u)
            ? "Mac"
            : /CrOS/.test(u)
              ? "Chromebook"
              : /Linux/.test(u)
                ? "Linux"
                : "aparelho desconhecido";
  return `${navegador} no ${sistema}`;
}

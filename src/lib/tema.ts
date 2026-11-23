/** Tema da tela: "sistema" segue o aparelho; claro e escuro ficam fixos neste aparelho. */
export type Tema = "claro" | "escuro" | "sistema";

export const COOKIE_TEMA = "hb_tema";

export function temaAtual(): Tema {
  if (typeof document === "undefined") return "sistema";
  const v = document.documentElement.dataset.tema;
  return v === "claro" || v === "escuro" ? v : "sistema";
}

export function aplicarTema(tema: Tema) {
  const raiz = document.documentElement;
  if (tema === "sistema") {
    delete raiz.dataset.tema;
    document.cookie = `${COOKIE_TEMA}=; path=/; max-age=0; samesite=lax`;
  } else {
    raiz.dataset.tema = tema;
    document.cookie = `${COOKIE_TEMA}=${tema}; path=/; max-age=31536000; samesite=lax`;
  }
}

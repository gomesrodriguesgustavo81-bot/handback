/** Concordância entre o conceito sugerido pela IA e o conceito final de quem avalia. */

export const ORDEM_CONCEITOS = ["EXCELENTE", "BOM", "REGULAR", "RUIM"] as const;
const PESO: Record<string, number> = { EXCELENTE: 4, BOM: 3, REGULAR: 2, RUIM: 1 };

export type Par = { ia: string | null; final: string | null };

export type Resumo = {
  total: number;
  iguais: number;
  /** IA deu conceito mais alto que quem avalia. */
  iaMaisAlta: number;
  /** IA deu conceito mais baixo que quem avalia. */
  iaMaisBaixa: number;
  /** Diferença de 2 ou mais conceitos (ex.: IA BOM, final RUIM). */
  distantes: number;
  /** matriz[conceitoIA][conceitoFinal] = quantidade */
  matriz: Record<string, Record<string, number>>;
};

export function resumirConcordancia(pares: Par[]): Resumo {
  const matriz: Resumo["matriz"] = Object.fromEntries(ORDEM_CONCEITOS.map((a) => [a, Object.fromEntries(ORDEM_CONCEITOS.map((b) => [b, 0]))]));
  const r: Resumo = { total: 0, iguais: 0, iaMaisAlta: 0, iaMaisBaixa: 0, distantes: 0, matriz };
  for (const { ia, final } of pares) {
    if (!ia || !final || !(ia in PESO) || !(final in PESO)) continue; // PENDENTE e sem análise ficam de fora
    r.total++;
    matriz[ia][final]++;
    const d = PESO[ia] - PESO[final];
    if (d === 0) r.iguais++;
    else if (d > 0) r.iaMaisAlta++;
    else r.iaMaisBaixa++;
    if (Math.abs(d) >= 2) r.distantes++;
  }
  return r;
}

/** Frase simples sobre a tendência da IA (ou null se ainda não há o que dizer). */
export function tendencia(r: Resumo): string | null {
  if (r.total < 3) return null;
  const erros = r.iaMaisAlta + r.iaMaisBaixa;
  if (!erros) return "A IA concordou com você em todas as avaliações.";
  if (r.iaMaisAlta >= 2 * Math.max(1, r.iaMaisBaixa)) return "Quando erra, a IA costuma ser mais generosa que você (dá conceito mais alto).";
  if (r.iaMaisBaixa >= 2 * Math.max(1, r.iaMaisAlta)) return "Quando erra, a IA costuma ser mais rigorosa que você (dá conceito mais baixo).";
  return "Quando erra, a IA erra para os dois lados, sem uma tendência clara.";
}

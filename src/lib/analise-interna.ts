/**
 * A análise interna vem da IA num texto corrido ("Pontos fortes: … Lacunas: …").
 * Aqui ela vira partes separadas, para a tela mostrar uma por linha.
 */
export type TipoParte = "fortes" | "lacunas" | "riscos" | "fazer" | "outro";
export type Parte = { tipo: TipoParte; titulo: string; itens: string[] };

const ROTULOS: { re: RegExp; tipo: TipoParte; titulo: string }[] = [
  { re: /pontos?\s+fortes?/i, tipo: "fortes", titulo: "O que foi bem" },
  { re: /lacunas?|pontos?\s+fracos?|faltou/i, tipo: "lacunas", titulo: "O que faltou" },
  { re: /riscos?/i, tipo: "riscos", titulo: "Riscos" },
  { re: /sugest(ão|ões|ao|oes)(\s+de\s+interven(ção|ções|cao))?|interven(ção|cao)|pr[oó]ximos?\s+passos?/i, tipo: "fazer", titulo: "O que fazer" },
];
const CABECA = /(pontos?\s+fortes?|lacunas?|pontos?\s+fracos?|riscos?|sugest(?:ão|ões|ao|oes)(?:\s+de\s+interven(?:ção|ções|cao))?|interven(?:ção|cao)|pr[oó]ximos?\s+passos?)\s*:/gi;

/** Quebra em itens curtos (ponto e vírgula, linhas ou marcadores). */
function itens(texto: string): string[] {
  return texto
    .split(/\s*(?:;|\n|•|^\s*-\s)\s*/m)
    .map((x) => x.replace(/^[-–•*]\s*/, "").replace(/[.;]\s*$/, "").trim())
    .filter(Boolean)
    .map((x) => x[0].toUpperCase() + x.slice(1));
}

/** Devolve as partes, ou null quando o texto não tem os tópicos (aí mostra o texto como veio). */
export function partesDaAnalise(texto: string): Parte[] | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  const marcas = [...t.matchAll(CABECA)];
  if (marcas.length < 2) return null;
  const partes: Parte[] = [];
  const antes = t.slice(0, marcas[0].index).trim();
  if (antes) partes.push({ tipo: "outro", titulo: "Resumo", itens: itens(antes) });
  marcas.forEach((m, i) => {
    const fim = i + 1 < marcas.length ? marcas[i + 1].index : t.length;
    const corpo = t.slice((m.index ?? 0) + m[0].length, fim).trim();
    const r = ROTULOS.find((x) => x.re.test(m[1])) ?? { tipo: "outro" as const, titulo: m[1] };
    const lista = itens(corpo);
    if (lista.length) partes.push({ tipo: r.tipo, titulo: r.titulo, itens: lista });
  });
  return partes.length ? partes : null;
}

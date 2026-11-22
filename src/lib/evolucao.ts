/** Evolução de uma equipe ao longo das etapas (ciclos, aulas, encontros…). */

const PESO: Record<string, number> = { EXCELENTE: 4, BOM: 3, REGULAR: 2, RUIM: 1 };

export type Celula =
  | { tipo: "aprovado"; conceito: string; entregaId: string }
  | { tipo: "revisar"; conceito: string | null; entregaId: string }
  | { tipo: "sem-analise"; entregaId: string }
  | { tipo: "nao-entregou" }
  | { tipo: "aguardando" };

export type Tendencia = "melhorou" | "caiu" | "manteve" | "sem-dados";

export type Evolucao = { tendencia: Tendencia; atencao: boolean; motivos: string[] };

/** Células em ordem de etapa. Compara os dois últimos conceitos aprovados. */
export function evolucaoDaEquipe(celulas: Celula[]): Evolucao {
  const aprovados = celulas.filter((c): c is Extract<Celula, { tipo: "aprovado" }> => c.tipo === "aprovado" && c.conceito in PESO);
  let tendencia: Tendencia = "sem-dados";
  if (aprovados.length >= 2) {
    const d = PESO[aprovados.at(-1)!.conceito] - PESO[aprovados.at(-2)!.conceito];
    tendencia = d > 0 ? "melhorou" : d < 0 ? "caiu" : "manteve";
  } else if (aprovados.length === 1) {
    tendencia = "manteve";
  }
  const motivos: string[] = [];
  if (aprovados.at(-1)?.conceito === "RUIM") motivos.push("RUIM no último conceito");
  if (tendencia === "caiu") motivos.push("caiu em relação ao anterior");
  const faltas = celulas.filter((c) => c.tipo === "nao-entregou").length;
  if (faltas >= 2) motivos.push(`não entregou ${faltas} vezes`);
  if (aprovados.length === 1 && tendencia === "manteve") tendencia = "sem-dados";
  return { tendencia, atencao: motivos.length > 0, motivos };
}

export const ROTULO_TENDENCIA: Record<Tendencia, string> = {
  melhorou: "Melhorou",
  caiu: "Caiu",
  manteve: "Manteve",
  "sem-dados": "Sem comparação",
};

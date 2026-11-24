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

type LinhaResumo = { grupo_id: string; etapa_id: string; analises: { status: string; conceito: string | null } | { status: string; conceito: string | null }[] | null };

/** Resumo da turma (para o topo dos ciclos): quantos melhoraram, caíram e precisam de atenção. */
export function resumoDaTurma(
  grupos: { id: string }[],
  etapas: { id: string; recebe_ate: string | null }[],
  entregas: LinhaResumo[],
  hoje: string,
): { melhorou: number; caiu: number; atencao: number } {
  const de = new Map(entregas.map((e) => [`${e.grupo_id}:${e.etapa_id}`, e]));
  const r = { melhorou: 0, caiu: 0, atencao: 0 };
  for (const g of grupos) {
    const celulas: Celula[] = etapas.map((et) => {
      const e = de.get(`${g.id}:${et.id}`);
      if (!e) return et.recebe_ate && hoje > et.recebe_ate ? { tipo: "nao-entregou" } : { tipo: "aguardando" };
      const a = Array.isArray(e.analises) ? e.analises[0] : e.analises;
      if (a?.status === "aprovada" && a.conceito) return { tipo: "aprovado", conceito: a.conceito, entregaId: "" };
      if (a?.status === "pronta") return { tipo: "revisar", conceito: a.conceito, entregaId: "" };
      return { tipo: "sem-analise", entregaId: "" };
    });
    const ev = evolucaoDaEquipe(celulas);
    if (ev.tendencia === "melhorou") r.melhorou++;
    if (ev.tendencia === "caiu") r.caiu++;
    if (ev.atencao) r.atencao++;
  }
  return r;
}

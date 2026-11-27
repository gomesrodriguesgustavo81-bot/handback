/**
 * Gasto da IA: soma dos tokens que o Google cobrou, por mês e por turma. Só números (nunca texto do aluno).
 * O custo em reais é tokens × preço do Google; o preço muda, então aqui só aparecem os tokens.
 */
export type LinhaUso = { criado_em: string; tokens_entrada: number; tokens_saida: number; turma_id: string | null };

export type Soma = { analises: number; entrada: number; saida: number };
export type GastoPorMes = Soma & { mes: string };
export type GastoPorTurma = Soma & { turmaId: string | null };

const zero = (): Soma => ({ analises: 0, entrada: 0, saida: 0 });
const somar = (a: Soma, l: LinhaUso): Soma => ({ analises: a.analises + 1, entrada: a.entrada + (l.tokens_entrada || 0), saida: a.saida + (l.tokens_saida || 0) });

/** "2026-11": o mês no horário de Brasília. */
export function mesDe(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(d).slice(0, 7);
}

export function resumirGasto(linhas: LinhaUso[], agoraISO: string, meses = 6) {
  const atual = mesDe(agoraISO);
  const porMes = new Map<string, Soma>();
  const porTurma = new Map<string | null, Soma>();
  let total = zero();
  for (const l of linhas) {
    const m = mesDe(l.criado_em);
    if (!m) continue;
    total = somar(total, l);
    porMes.set(m, somar(porMes.get(m) ?? zero(), l));
    porTurma.set(l.turma_id, somar(porTurma.get(l.turma_id) ?? zero(), l));
  }
  const lista: GastoPorMes[] = [...porMes.entries()].map(([mes, s]) => ({ mes, ...s })).sort((a, b) => b.mes.localeCompare(a.mes)).slice(0, meses);
  return {
    total,
    mesAtual: porMes.get(atual) ?? zero(),
    porMes: lista,
    porTurma: [...porTurma.entries()].map(([turmaId, s]) => ({ turmaId, ...s })).sort((a, b) => b.entrada + b.saida - (a.entrada + a.saida)),
  };
}

export const mediaPorAnalise = (s: Soma) => (s.analises ? { entrada: Math.round(s.entrada / s.analises), saida: Math.round(s.saida / s.analises) } : { entrada: 0, saida: 0 });

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export function nomeDoMes(mes: string): string {
  const [a, m] = mes.split("-");
  const nome = NOMES_MES[Number(m) - 1];
  return nome ? `${nome} de ${a}` : mes;
}

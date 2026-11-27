/**
 * O que a coordenação e a banca enxergam: contas feitas em cima das linhas que o banco
 * devolve (só "entregou", "atrasou" e o conceito já aprovado; nunca devolutiva nem arquivo).
 */
import { evolucaoDaEquipe, type Celula, type Tendencia } from "./evolucao";

export const CONCEITOS = ["EXCELENTE", "BOM", "REGULAR", "RUIM"] as const;
export type Conceito = (typeof CONCEITOS)[number];

export type LinhaCoord = {
  turma_id: string;
  turma_nome: string;
  turma_modo: string;
  etapa_id: string;
  etapa_numero: number;
  etapa_titulo: string;
  recebe_ate: string | null;
  grupo_n: number;
  grupo_nome: string | null;
  entregou: boolean;
  atrasada: boolean;
  conceito: string | null;
};

export type Contagem = Record<Conceito, number>;
const zerar = (): Contagem => ({ EXCELENTE: 0, BOM: 0, REGULAR: 0, RUIM: 0 });
const eConceito = (c: string | null): c is Conceito => c !== null && (CONCEITOS as readonly string[]).includes(c);

export type ResumoEtapa = {
  id: string;
  numero: number;
  titulo: string;
  prazo: string | null;
  /** Quantos alunos ou equipes a turma tem. */
  total: number;
  entregues: number;
  aprovadas: number;
  conceitos: Contagem;
  atrasadas: number;
};

export type ResumoPessoa = {
  n: number;
  /** Só vem quando quem convidou deixou ligado. */
  nome: string | null;
  atual: Conceito | null;
  anterior: Conceito | null;
  tendencia: Tendencia;
  atencao: boolean;
  motivos: string[];
  atrasos: number;
};

export type SinalDaTurma = "melhorando" | "caindo" | "estavel" | "sem-dados";

export type ResumoTurma = {
  id: string;
  nome: string;
  modo: string;
  pessoas: number;
  etapas: ResumoEtapa[];
  /** Último conceito aprovado de cada aluno ou equipe. */
  conceitosAtuais: Contagem;
  /** Entregas que já deviam ter chegado (prazo vencido ou já entregues) e quantas chegaram. */
  esperadas: number;
  recebidas: number;
  aprovadas: number;
  atrasadas: number;
  atencao: number;
  sinal: SinalDaTurma;
  /** "Ruim" entre as duas últimas entregas que já têm conceito aprovado (para o aviso de piora). */
  mudancaDeRuim: { de: number; para: number; entre: [number, number] } | null;
  lista: ResumoPessoa[];
};

export type ResumoGeral = {
  turmas: ResumoTurma[];
  recebidas: number;
  esperadas: number;
  aprovadas: number;
  atrasadas: number;
  atencao: number;
};

/** Agrupa as linhas do banco em um resumo por turma e um geral. `hoje` é AAAA-MM-DD. */
export function resumirCoordenacao(linhas: LinhaCoord[], hoje: string): ResumoGeral {
  const porTurma = new Map<string, LinhaCoord[]>();
  for (const l of linhas) porTurma.set(l.turma_id, [...(porTurma.get(l.turma_id) ?? []), l]);

  const turmas: ResumoTurma[] = [...porTurma.values()]
    .map((ls) => resumirTurma(ls, hoje))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    turmas,
    recebidas: soma(turmas, (t) => t.recebidas),
    esperadas: soma(turmas, (t) => t.esperadas),
    aprovadas: soma(turmas, (t) => t.aprovadas),
    atrasadas: soma(turmas, (t) => t.atrasadas),
    atencao: soma(turmas, (t) => t.atencao),
  };
}

const soma = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

function resumirTurma(ls: LinhaCoord[], hoje: string): ResumoTurma {
  const etapasMap = new Map<string, LinhaCoord[]>();
  const pessoasMap = new Map<number, LinhaCoord[]>();
  for (const l of ls) {
    etapasMap.set(l.etapa_id, [...(etapasMap.get(l.etapa_id) ?? []), l]);
    pessoasMap.set(l.grupo_n, [...(pessoasMap.get(l.grupo_n) ?? []), l]);
  }

  const etapas: ResumoEtapa[] = [...etapasMap.values()]
    .map((es) => {
      const conceitos = zerar();
      for (const e of es) if (eConceito(e.conceito)) conceitos[e.conceito]++;
      const e0 = es[0];
      return {
        id: e0.etapa_id,
        numero: e0.etapa_numero,
        titulo: e0.etapa_titulo,
        prazo: e0.recebe_ate,
        total: es.length,
        entregues: es.filter((e) => e.entregou).length,
        aprovadas: es.filter((e) => eConceito(e.conceito)).length,
        conceitos,
        atrasadas: es.filter((e) => e.atrasada).length,
      };
    })
    .sort((a, b) => a.numero - b.numero);

  const lista: ResumoPessoa[] = [...pessoasMap.entries()]
    .map(([n, mine]) => {
      const ordenadas = [...mine].sort((a, b) => a.etapa_numero - b.etapa_numero);
      const celulas: Celula[] = ordenadas.map((l) => {
        if (eConceito(l.conceito)) return { tipo: "aprovado", conceito: l.conceito, entregaId: "" };
        if (l.entregou) return { tipo: "sem-analise", entregaId: "" };
        return l.recebe_ate && hoje > l.recebe_ate ? { tipo: "nao-entregou" } : { tipo: "aguardando" };
      });
      const ev = evolucaoDaEquipe(celulas);
      const aprovados = ordenadas.map((l) => l.conceito).filter(eConceito);
      return {
        n,
        nome: ordenadas[0].grupo_nome,
        atual: aprovados.at(-1) ?? null,
        anterior: aprovados.at(-2) ?? null,
        tendencia: ev.tendencia,
        atencao: ev.atencao,
        motivos: ev.motivos,
        atrasos: ordenadas.filter((l) => l.atrasada).length,
      };
    })
    .sort((a, b) => Number(b.atencao) - Number(a.atencao) || a.n - b.n);

  const conceitosAtuais = zerar();
  for (const p of lista) if (p.atual) conceitosAtuais[p.atual]++;

  const melhoraram = lista.filter((p) => p.tendencia === "melhorou").length;
  const cairam = lista.filter((p) => p.tendencia === "caiu").length;
  const comDado = lista.some((p) => p.tendencia !== "sem-dados");
  const sinal: SinalDaTurma = !comDado ? "sem-dados" : cairam > melhoraram ? "caindo" : melhoraram > cairam ? "melhorando" : "estavel";

  const comAprovacao = etapas.filter((e) => e.aprovadas > 0);
  const [antes, depois] = [comAprovacao.at(-2), comAprovacao.at(-1)];
  const mudancaDeRuim =
    antes && depois && antes.conceitos.RUIM !== depois.conceitos.RUIM
      ? { de: antes.conceitos.RUIM, para: depois.conceitos.RUIM, entre: [antes.numero, depois.numero] as [number, number] }
      : null;

  const esperadas = ls.filter((l) => l.entregou || (l.recebe_ate !== null && hoje > l.recebe_ate)).length;
  return {
    id: ls[0].turma_id,
    nome: ls[0].turma_nome,
    modo: ls[0].turma_modo,
    pessoas: pessoasMap.size,
    etapas,
    conceitosAtuais,
    esperadas,
    recebidas: ls.filter((l) => l.entregou).length,
    aprovadas: ls.filter((l) => eConceito(l.conceito)).length,
    atrasadas: ls.filter((l) => l.atrasada).length,
    atencao: lista.filter((p) => p.atencao).length,
    sinal,
    mudancaDeRuim,
    lista,
  };
}

export const ROTULO_SINAL: Record<SinalDaTurma, { texto: string; seta: string; classe: string }> = {
  melhorando: { texto: "Melhorando", seta: "↑", classe: "bg-ok-fundo text-ok" },
  caindo: { texto: "Caindo", seta: "↓", classe: "bg-ruim-fundo text-ruim" },
  estavel: { texto: "Estável", seta: "→", classe: "bg-neutro-fundo text-neutro" },
  "sem-dados": { texto: "Sem comparação", seta: "·", classe: "bg-neutro-fundo text-neutro" },
};

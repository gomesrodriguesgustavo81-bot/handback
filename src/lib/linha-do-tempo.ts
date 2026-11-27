/**
 * Linha do tempo de um aluno/equipe e as duas comparações opcionais:
 * entre duas entregas dele e dele com a turma. Só contas; nada aqui chama IA
 * nem mexe no conceito de ninguém.
 */
import { normalizarAlertas, temAlertaCritico } from "./ia/alertas";

export const PESO_CONCEITO: Record<string, number> = { EXCELENTE: 4, BOM: 3, REGULAR: 2, RUIM: 1 };

/** Com menos aprovados que isso a comparação com a turma não é confiável. */
export const MINIMO_DA_TURMA = 5;

export type EtapaBase = { id: string; numero: number; titulo: string; recebe_ate: string | null };

export type ItemDoChecklist = { item: string; status: string };

export type AnaliseBase = {
  status: string;
  conceito: string | null;
  checklist: unknown;
  alertas: unknown;
  devolutiva: string;
};

export type EntregaBase = {
  id: string;
  grupo_id: string;
  etapa_id: string;
  enviada_em: string;
  atrasada: boolean;
  analises: AnaliseBase | AnaliseBase[] | null;
};

export type Situacao = "aprovada" | "revisar" | "sem-analise" | "nao-entregou" | "aguardando";

export type Ponto = {
  etapaId: string;
  numero: number;
  titulo: string;
  prazo: string | null;
  entregaId: string | null;
  situacao: Situacao;
  /** Só existe quando o professor já aprovou. */
  conceito: string | null;
  itens: ItemDoChecklist[];
  entregues: number;
  atrasou: boolean;
  /** Dias de atraso (só quando atrasou e dá para calcular). */
  diasDeAtraso: number | null;
  alertas: number;
  grave: boolean;
  devolutiva: string;
};

export function lerChecklist(bruto: unknown): ItemDoChecklist[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter((c): c is { item?: unknown; status?: unknown } => Boolean(c) && typeof c === "object")
    .map((c) => ({ item: typeof c.item === "string" ? c.item : "", status: typeof c.status === "string" ? c.status : "" }))
    .filter((c) => c.item)
    .slice(0, 100);
}

function analiseDe(e: EntregaBase | undefined): AnaliseBase | null {
  if (!e) return null;
  return (Array.isArray(e.analises) ? e.analises[0] : e.analises) ?? null;
}

/** Diferença em dias entre a data de envio (dia local de São Paulo) e o prazo (AAAA-MM-DD). */
export function diasDeAtraso(enviadaEm: string, prazo: string | null): number | null {
  if (!prazo) return null;
  const quando = new Date(enviadaEm);
  if (Number.isNaN(quando.getTime())) return null;
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(quando);
  const d = Math.round((Date.parse(`${dia}T00:00:00Z`) - Date.parse(`${prazo}T00:00:00Z`)) / 86_400_000);
  return d > 0 ? d : 0;
}

/** Um ponto por entrega do cadastro, na ordem. `hoje` é AAAA-MM-DD. */
export function montarLinhaDoTempo(etapas: EtapaBase[], entregas: EntregaBase[], hoje: string): Ponto[] {
  const porEtapa = new Map(entregas.map((e) => [e.etapa_id, e]));
  return [...etapas]
    .sort((a, b) => a.numero - b.numero)
    .map((et) => {
      const e = porEtapa.get(et.id);
      const base = { etapaId: et.id, numero: et.numero, titulo: et.titulo, prazo: et.recebe_ate };
      const vazio = { itens: [] as ItemDoChecklist[], entregues: 0, atrasou: false, diasDeAtraso: null, alertas: 0, grave: false, devolutiva: "" };
      if (!e) {
        const venceu = Boolean(et.recebe_ate && hoje > et.recebe_ate);
        return { ...base, ...vazio, entregaId: null, situacao: venceu ? "nao-entregou" : "aguardando", conceito: null } satisfies Ponto;
      }
      const a = analiseDe(e);
      const itens = lerChecklist(a?.checklist);
      const atraso = e.atrasada ? (diasDeAtraso(e.enviada_em, et.recebe_ate) ?? null) : null;
      const lista = a && a.status === "pronta" ? normalizarAlertas(a.alertas) : [];
      const risco = { quantidade: lista.length, critico: temAlertaCritico(lista) };
      const situacao: Situacao = a?.status === "aprovada" && a.conceito ? "aprovada" : a?.status === "pronta" ? "revisar" : "sem-analise";
      return {
        ...base,
        entregaId: e.id,
        situacao,
        // Só vale o conceito que o professor aprovou: o da IA ainda é rascunho.
        conceito: situacao === "aprovada" ? a!.conceito : null,
        itens,
        entregues: itens.filter((i) => i.status === "ENTREGUE").length,
        atrasou: e.atrasada,
        diasDeAtraso: atraso,
        alertas: risco.quantidade,
        grave: risco.critico,
        devolutiva: situacao === "aprovada" ? (a?.devolutiva ?? "") : "",
      } satisfies Ponto;
    });
}

export type Mudanca = "evoluiu" | "caiu" | "manteve" | "sem-comparacao";

/** Compara dois conceitos aprovados. `degraus` é quantos conceitos subiu (+) ou desceu (−). */
export function mudancaDeConceito(antes: string | null, depois: string | null): { mudanca: Mudanca; degraus: number } {
  if (!antes || !depois || !(antes in PESO_CONCEITO) || !(depois in PESO_CONCEITO)) return { mudanca: "sem-comparacao", degraus: 0 };
  const d = PESO_CONCEITO[depois] - PESO_CONCEITO[antes];
  return { mudanca: d > 0 ? "evoluiu" : d < 0 ? "caiu" : "manteve", degraus: d };
}

/** Pontos com análise concluída (aprovada ou esperando revisão): são os que dá para comparar. */
export function pontosComparaveis(pontos: Ponto[]): Ponto[] {
  return pontos.filter((p) => p.situacao === "aprovada" || p.situacao === "revisar");
}

/** A comparação entre duas entregas do mesmo aluno só faz sentido com pelo menos 2 analisadas. */
export function podeCompararEntregas(pontos: Ponto[]): boolean {
  return pontosComparaveis(pontos).length >= 2;
}

export type ItemPendente = { item: string; status: "PARCIAL" | "NAO_ENTREGUE" };

export type ComparacaoDeEntregas = {
  mudanca: Mudanca;
  degraus: number;
  /** O que não estava completo na primeira. */
  faltouAntes: ItemPendente[];
  /** Como ficou cada item da segunda. */
  depois: ItemDoChecklist[];
  entreguesAntes: number;
  totalAntes: number;
  entreguesDepois: number;
  totalDepois: number;
  alertasAntes: number;
  alertasDepois: number;
};

export function compararEntregas(antes: Ponto, depois: Ponto): ComparacaoDeEntregas {
  const { mudanca, degraus } = mudancaDeConceito(antes.conceito, depois.conceito);
  return {
    mudanca,
    degraus,
    faltouAntes: antes.itens
      .filter((i) => i.status === "PARCIAL" || i.status === "NAO_ENTREGUE")
      .map((i) => ({ item: i.item, status: i.status as ItemPendente["status"] })),
    depois: depois.itens,
    entreguesAntes: antes.entregues,
    totalAntes: antes.itens.length,
    entreguesDepois: depois.entregues,
    totalDepois: depois.itens.length,
    alertasAntes: antes.alertas,
    alertasDepois: depois.alertas,
  };
}

/** Uma entrega de alguém da turma, já reduzida ao que a comparação usa. */
export type EntregaDaTurma = { grupoId: string; conceito: string | null; itens: ItemDoChecklist[]; atrasou: boolean };

export type ItemDaTurma = { item: string; turmaCompleto: number; seuStatus: string | null };

export type ComparacaoComTurma = {
  /** Quantos da turma têm conceito aprovado nesta entrega (contando o próprio). */
  aprovados: number;
  confiavel: boolean;
  distribuicao: { conceito: string; quantidade: number }[];
  /** Quantos aprovados tiveram o mesmo conceito dele (incluindo ele). */
  mesmoConceito: number;
  /** Média de itens entregues por pessoa. */
  mediaEntregues: number | null;
  totalItens: number;
  noPrazo: number;
  comPrazo: number;
  itens: ItemDaTurma[];
  /** O item em que menos gente entregou tudo (só quando confiável). */
  maisDificil: string | null;
};

const ordemConceitos = ["EXCELENTE", "BOM", "REGULAR", "RUIM"] as const;

/**
 * Compara um aluno/equipe com os demais da turma, só em números: quem são os
 * colegas nunca sai daqui. `todos` inclui ele mesmo.
 */
export function compararComTurma(eleId: string, todos: EntregaDaTurma[]): ComparacaoComTurma {
  const aprovadas = todos.filter((t) => t.conceito && t.conceito in PESO_CONCEITO);
  const ele = todos.find((t) => t.grupoId === eleId);
  const distribuicao = ordemConceitos.map((c) => ({ conceito: c as string, quantidade: aprovadas.filter((t) => t.conceito === c).length }));
  const confiavel = aprovadas.length >= MINIMO_DA_TURMA;

  const comChecklist = todos.filter((t) => t.itens.length > 0);
  const media = comChecklist.length
    ? comChecklist.reduce((s, t) => s + t.itens.filter((i) => i.status === "ENTREGUE").length, 0) / comChecklist.length
    : null;

  // Todos recebem o mesmo checklist, na mesma ordem: compara item a item pela posição.
  const modelo = ele?.itens.length ? ele.itens : (comChecklist[0]?.itens ?? []);
  const itens: ItemDaTurma[] = modelo.map((m, i) => {
    const respostas = comChecklist.map((t) => t.itens[i]).filter(Boolean);
    const completos = respostas.filter((r) => r.status === "ENTREGUE").length;
    return {
      item: m.item,
      turmaCompleto: respostas.length ? Math.round((completos / respostas.length) * 100) : 0,
      seuStatus: ele?.itens[i]?.status ?? null,
    };
  });
  const maisDificil = confiavel && itens.length ? [...itens].sort((a, b) => a.turmaCompleto - b.turmaCompleto)[0].item : null;

  return {
    aprovados: aprovadas.length,
    confiavel,
    distribuicao,
    mesmoConceito: ele?.conceito ? aprovadas.filter((t) => t.conceito === ele.conceito).length : 0,
    mediaEntregues: media === null ? null : Math.round(media * 10) / 10,
    totalItens: modelo.length,
    noPrazo: todos.filter((t) => !t.atrasou).length,
    comPrazo: todos.length,
    itens,
    maisDificil,
  };
}

/** Reduz uma entrega do banco ao que a comparação com a turma usa. */
export function paraEntregaDaTurma(e: EntregaBase): EntregaDaTurma {
  const a = analiseDe(e);
  return {
    grupoId: e.grupo_id,
    conceito: a?.status === "aprovada" && a.conceito ? a.conceito : null,
    itens: lerChecklist(a?.checklist),
    atrasou: e.atrasada,
  };
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vocabulario } from "./frentes";
import { completarVocabulario, type Vocab } from "./nomes";
import { hojeISO } from "./textos";

/**
 * Dados dos relatórios (PDF da equipe/aluno, PDF da turma, planilha).
 * Só entra o que já foi aprovado; a análise interna da IA nunca entra.
 */
export const CONCEITOS = ["EXCELENTE", "BOM", "REGULAR", "RUIM"] as const;
export type Conceito = (typeof CONCEITOS)[number];
const NIVEL: Record<string, number> = { EXCELENTE: 4, BOM: 3, REGULAR: 2, RUIM: 1 };

export type EtapaRel = { id: string; numero: number; titulo: string; recebe_ate: string | null; peso: number; moodle_tarefa: number | null; moodle_nota_max: number | null };
export type Pessoa = { nome: string; email: string; matricula: string };
export type Celula =
  | { tipo: "aprovado"; conceito: Conceito; nota: number; entregueEm: string; atrasada: boolean; feitos: number; total: number; devolutiva: string; devolvidaEm: string | null }
  | { tipo: "pendente"; entregueEm: string; atrasada: boolean }
  | { tipo: "nao-entregou" }
  | { tipo: "aguardando" };
export type GrupoRel = { id: string; nome: string; pessoas: Pessoa[]; celulas: Celula[]; media: number | null; atencao: string[] };

export type Relatorio = {
  org: { nome: string };
  turma: { id: string; nome: string; modo: "grupos" | "individual"; mediaAtiva: boolean };
  vc: Vocab;
  etapas: EtapaRel[];
  grupos: GrupoRel[];
  notas: Record<Conceito, number>;
  geradoEm: string;
};

export type FiltroAulas = "todas" | "encerradas";

/** Nota de 0 a 10 de um conceito, pela tabela das Configurações (mesma do Moodle). */
export function notaDe(conceito: string, notas: Record<string, number>): number {
  const p = Number(notas[conceito]);
  return Number.isFinite(p) ? Math.round(p) / 10 : 0;
}

/** Média ponderada pelos pesos. Não entregou (prazo passado) conta 0; o que ainda não foi avaliado fica de fora. */
export function mediaPonderada(celulas: Celula[], etapas: EtapaRel[]): number | null {
  let soma = 0;
  let pesos = 0;
  celulas.forEach((c, i) => {
    const peso = etapas[i]?.peso ?? 1;
    if (peso <= 0) return;
    if (c.tipo === "aprovado") {
      soma += c.nota * peso;
      pesos += peso;
    } else if (c.tipo === "nao-entregou") {
      pesos += peso;
    }
  });
  return pesos ? Math.round((soma / pesos) * 10) / 10 : null;
}

function motivosDeAtencao(celulas: Celula[], vc: Vocab, etapas: EtapaRel[]): string[] {
  const m: string[] = [];
  const aprovados = celulas.map((c, i) => ({ c, e: etapas[i] })).filter((x) => x.c.tipo === "aprovado") as { c: Extract<Celula, { tipo: "aprovado" }>; e: EtapaRel }[];
  const faltas = celulas.map((c, i) => ({ c, e: etapas[i] })).filter((x) => x.c.tipo === "nao-entregou");
  if (faltas.length) m.push(`Não entregou ${faltas.map((x) => `${vc.etapa} ${x.e.numero}`).join(", ")}`);
  const ult = aprovados.at(-1);
  const pen = aprovados.at(-2);
  if (ult && pen && NIVEL[ult.c.conceito] < NIVEL[pen.c.conceito]) {
    m.push(`Caiu de ${pen.c.conceito.toLowerCase()} para ${ult.c.conceito.toLowerCase()} n${/a$/i.test(vc.etapa) ? "a" : "o"} ${vc.etapa} ${ult.e.numero}`);
  } else if (ult?.c.conceito === "RUIM") {
    m.push(`Ruim n${/a$/i.test(vc.etapa) ? "a" : "o"} ${vc.etapa} ${ult.e.numero}`);
  }
  return m;
}

type LinhaEntrega = {
  id: string;
  grupo_id: string;
  etapa_id: string;
  enviada_em: string;
  atrasada: boolean;
  analises: { status: string; conceito: string | null; checklist: { status: string }[] | null; devolutiva: string; enviada_em: string | null; moodle_enviada_em: string | null; aprovada_em: string | null } | null;
};

export async function carregarRelatorio(
  supabase: SupabaseClient,
  empresa: { id: string; nome: string; vocabulario: Vocabulario },
  turmaId: string,
  aulas: FiltroAulas = "todas",
): Promise<Relatorio | null> {
  const hoje = hojeISO();
  const [{ data: turma }, { data: org }, { data: etapasBrutas }, { data: grupos }, { data: entregas }] = await Promise.all([
    supabase.from("turmas").select("id, nome, modo, media_ativa").eq("id", turmaId).eq("org_id", empresa.id).maybeSingle(),
    supabase.from("organizacoes").select("notas_moodle").eq("id", empresa.id).single(),
    supabase.from("etapas").select("id, numero, titulo, recebe_ate, peso, moodle_tarefa, moodle_nota_max").eq("turma_id", turmaId).order("numero"),
    supabase.from("grupos").select("id, nome, integrantes(nome, email, matricula)").eq("turma_id", turmaId).eq("ativo", true).eq("escondido", false).order("nome"),
    supabase
      .from("entregas")
      .select("id, grupo_id, etapa_id, enviada_em, atrasada, analises(status, conceito, checklist, devolutiva, enviada_em, moodle_enviada_em, aprovada_em)")
      .eq("org_id", empresa.id)
      .eq("status", "recebida"),
  ]);
  if (!turma) return null;
  const vc = completarVocabulario(empresa.vocabulario);
  const notas = { EXCELENTE: 100, BOM: 80, REGULAR: 60, RUIM: 40, ...((org?.notas_moodle as Record<string, number>) ?? {}) };
  const notas10 = Object.fromEntries(CONCEITOS.map((c) => [c, notaDe(c, notas)])) as Record<Conceito, number>;
  const etapas: EtapaRel[] = (etapasBrutas ?? [])
    .map((e) => ({ ...e, peso: Number(e.peso ?? 1) }))
    .filter((e) => aulas === "todas" || (e.recebe_ate && e.recebe_ate < hoje));
  const porChave = new Map(((entregas ?? []) as unknown as LinhaEntrega[]).map((e) => [`${e.grupo_id}:${e.etapa_id}`, e]));

  const lista: GrupoRel[] = (grupos ?? []).map((g) => {
    const celulas: Celula[] = etapas.map((et) => {
      const e = porChave.get(`${g.id}:${et.id}`);
      if (!e) return et.recebe_ate && hoje > et.recebe_ate ? { tipo: "nao-entregou" } : { tipo: "aguardando" };
      const a = e.analises;
      if (a?.status === "aprovada" && a.conceito && a.conceito in NIVEL) {
        const lista = a.checklist ?? [];
        return {
          tipo: "aprovado",
          conceito: a.conceito as Conceito,
          nota: notas10[a.conceito as Conceito],
          entregueEm: e.enviada_em,
          atrasada: e.atrasada,
          feitos: lista.filter((x) => x.status === "ENTREGUE").length,
          total: lista.length,
          devolutiva: a.devolutiva,
          devolvidaEm: a.enviada_em ?? a.moodle_enviada_em ?? a.aprovada_em,
        };
      }
      return { tipo: "pendente", entregueEm: e.enviada_em, atrasada: e.atrasada };
    });
    const pessoas = ((g.integrantes ?? []) as Pessoa[])
      .map((p) => ({ nome: p.nome || p.email.split("@")[0], email: p.email, matricula: p.matricula ?? "" }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return {
      id: g.id,
      nome: g.nome,
      pessoas,
      celulas,
      media: turma.media_ativa ? mediaPonderada(celulas, etapas) : null,
      atencao: motivosDeAtencao(celulas, vc, etapas),
    };
  });

  return {
    org: { nome: empresa.nome },
    turma: { id: turma.id, nome: turma.nome, modo: turma.modo === "individual" ? "individual" : "grupos", mediaAtiva: Boolean(turma.media_ativa) },
    vc,
    etapas,
    grupos: lista,
    notas: notas10,
    geradoEm: new Date().toISOString(),
  };
}

/** Nota formatada à brasileira: 8,1 */
export const nota = (n: number | null) => (n === null ? "—" : n.toFixed(1).replace(".", ","));

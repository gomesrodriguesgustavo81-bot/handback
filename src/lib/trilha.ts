/**
 * A trilha de cada ciclo: 1 Tarefa pronta → 2 Receber → 3 Analisar →
 * 4 Revisar → 5 Enviar. Diz em que passo o ciclo está e quanto falta em
 * cada um, para a tela mostrar sempre UM próximo passo.
 */

export type Contagem = {
  /** Itens no checklist do ciclo. */
  checklist: number;
  /** Turma do Classroom e o ciclo ainda não tem tarefa lá. */
  faltaTarefaClassroom: boolean;
  /** Quem deveria entregar (equipes ou alunos ativos da turma). */
  total: number;
  entregaram: number;
  /** Arquivos que chegaram no Classroom e ainda não vieram para o Handback. */
  esperando: number;
  /** Entregas sem análise ou com análise que falhou (e fora da fila). */
  semAnalise: number;
  /** Na fila ou analisando agora. */
  analisando: number;
  revisar: number;
  /** Aprovadas que ainda não saíram por nenhum caminho. */
  enviar: number;
  enviadas: number;
  prazoPassou: boolean;
};

export type EstadoPasso = "feito" | "agora" | "depois";
export type Passo = { n: 1 | 2 | 3 | 4 | 5; nome: string; estado: EstadoPasso; resumo: string };
/** 6 = ciclo concluído. */
export type Trilha = { atual: 1 | 2 | 3 | 4 | 5 | 6; passos: Passo[] };

const NOMES = ["Tarefa pronta", "Receber", "Analisar com a IA", "Revisar", "Enviar para os alunos"] as const;
const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Em que passo o ciclo está: o primeiro que tem trabalho esperando pelo professor. */
export function passoAtual(c: Contagem): Trilha["atual"] {
  if (!c.checklist || c.faltaTarefaClassroom) return 1;
  if (c.esperando) return 2;
  if (c.semAnalise || c.analisando) return 3;
  if (c.revisar) return 4;
  if (c.enviar) return 5;
  // Nada esperando: ou ainda faltam entregas, ou acabou.
  if (!c.entregaram || (!c.prazoPassou && c.entregaram < c.total)) return 2;
  return 6;
}

export function calcularTrilha(c: Contagem): Trilha {
  const atual = passoAtual(c);
  const resumos = [
    !c.checklist
      ? "Falta escrever o que o aluno entrega"
      : c.faltaTarefaClassroom
        ? `${pl(c.checklist, "item", "itens")} no checklist · falta publicar no Classroom`
        : `${pl(c.checklist, "item", "itens")} no checklist`,
    `${c.entregaram} de ${c.total} ${c.total === 1 ? "entregou" : "entregaram"}${c.esperando ? ` · ${pl(c.esperando, "arquivo esperando", "arquivos esperando")}` : ""}`,
    c.semAnalise
      ? `${pl(c.semAnalise, "entrega sem análise", "entregas sem análise")}`
      : c.analisando
        ? `A IA está analisando ${c.analisando}`
        : c.entregaram
          ? "Todas analisadas"
          : "Começa quando chegarem entregas",
    c.revisar ? `${pl(c.revisar, "devolutiva esperando você", "devolutivas esperando você")}` : c.enviar + c.enviadas ? "Tudo revisado" : "Você lê, ajusta e aprova",
    c.enviar ? `${pl(c.enviar, "aprovada pronta", "aprovadas prontas")} para sair` : c.enviadas ? `${pl(c.enviadas, "enviada", "enviadas")}` : "Libera quando você aprovar",
  ];
  const passos = NOMES.map((nome, i) => {
    const n = (i + 1) as Passo["n"];
    const estado: EstadoPasso = n < atual ? "feito" : n === atual ? "agora" : "depois";
    return { n, nome, estado, resumo: resumos[i] };
  });
  return { atual, passos };
}

/** Texto curto do passo atual, para cartões e listas ("Passo 4 de 5 · Revisar"). */
export function rotuloDoPasso(t: Trilha): string {
  if (t.atual === 6) return "Concluído";
  return `Passo ${t.atual} de 5 · ${NOMES[t.atual - 1]}`;
}

type Analise = { status: string; iniciada_em: string | null; enviada_em: string | null; moodle_enviada_em: string | null; classroom_enviada_em: string | null };
export type EntregaDaTrilha = { id: string; etapa_id: string; grupo_id: string; analises: Analise | Analise[] | null };

/** Monta as contagens de um ciclo a partir das entregas (com a análise de cada uma). */
export function contarEntregas(
  entregas: EntregaDaTrilha[],
  naFila: Set<string>,
  agora = Date.now(),
): Pick<Contagem, "entregaram" | "semAnalise" | "analisando" | "revisar" | "enviar" | "enviadas"> {
  const r = { entregaram: 0, semAnalise: 0, analisando: 0, revisar: 0, enviar: 0, enviadas: 0 };
  for (const e of entregas) {
    r.entregaram++;
    const a = Array.isArray(e.analises) ? e.analises[0] : e.analises;
    if (naFila.has(e.id)) r.analisando++;
    else if (!a) r.semAnalise++;
    else if (a.status === "pronta") r.revisar++;
    else if (a.status === "aprovada") {
      if (a.enviada_em || a.moodle_enviada_em || a.classroom_enviada_em) r.enviadas++;
      else r.enviar++;
    } else if (a.status === "analisando" && a.iniciada_em && agora - new Date(a.iniciada_em).getTime() < 5 * 60_000) r.analisando++;
    else r.semAnalise++;
  }
  return r;
}

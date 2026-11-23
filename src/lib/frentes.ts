/** As quatro frentes do Handback (precisam bater com o tipo "frente" do banco). */
export const FRENTES = {
  educacao: { nome: "Escola, faculdade ou curso", curto: "Educação" },
  empresa: { nome: "Empresa (gestor recebe do time)", curto: "Empresa" },
  consultoria: { nome: "Consultoria", curto: "Consultoria" },
  escritorio: { nome: "Contabilidade ou advocacia", curto: "Escritório" },
} as const;

export type Frente = keyof typeof FRENTES;

export function eFrente(valor: unknown): valor is Frente {
  return typeof valor === "string" && valor in FRENTES;
}

export const PAPEIS = {
  admin: "Administrador",
  avaliador: "Avaliador",
  participante: "Participante",
} as const;

export type Papel = keyof typeof PAPEIS;

/** Palavras que cada empresa usa no dia a dia (guardadas em organizacoes.vocabulario). */
export type Vocabulario = {
  etapa: string;
  etapas: string;
  avaliador: string;
  avaliadores: string;
  grupo: string;
  grupos: string;
  /** Turma, programa, projeto… (contas antigas não têm: veja completarVocabulario). */
  espaco?: string;
  espacos?: string;
  /** Quem está dentro de um grupo, ou quem entrega no modo individual (Aluno, Residente…). */
  pessoa?: string;
  pessoas?: string;
  /** Como o cliente chama o próprio espaço no Handback (Escola, Escritório, Time…). */
  organizacao?: string;
  organizacoes?: string;
  /** Como se chama o número de cada aluno (Matrícula, nº USP, RA…). */
  matricula?: string;
  generos?: Partial<Record<"etapa" | "grupo" | "espaco" | "pessoa" | "organizacao", "f" | "m">>;
};

/** Filtros do registro de atividades. */
export const FILTROS_REGISTRO = {
  todos: { nome: "Tudo", tipos: [] as string[] },
  acessos: { nome: "Acessos e segurança", tipos: ["acesso", "seguranca"] },
  documentos: { nome: "Documentos", tipos: ["documento"] },
  avaliacoes: { nome: "Avaliações", tipos: ["avaliacao"] },
  entregas: { nome: "Entregas", tipos: ["entrega"] },
  pessoas: { nome: "Pessoas", tipos: ["pessoas"] },
  cadastros: { nome: "Cadastros e ajustes", tipos: ["cadastros", "ajustes"] },
} as const;
export type FiltroRegistro = keyof typeof FILTROS_REGISTRO;

export const ROTULO_TIPO: Record<string, string> = {
  acesso: "Acesso",
  seguranca: "Segurança",
  documento: "Documento",
  avaliacao: "Avaliação",
  entrega: "Entrega",
  pessoas: "Pessoas",
  cadastros: "Cadastro",
  ajustes: "Ajustes",
};

export function lerFiltro(v: unknown): FiltroRegistro {
  return typeof v === "string" && v in FILTROS_REGISTRO ? (v as FiltroRegistro) : "todos";
}

/** Célula de planilha segura (aspas e sem fórmulas que o Excel executaria). */
export function celula(v: string): string {
  const t = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${t.replace(/"/g, '""')}"`;
}

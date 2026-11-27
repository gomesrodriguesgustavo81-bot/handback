/** As escolhas de como a IA ajuda: a conta define o padrão, a turma pode mudar (vazio na turma = segue a conta). */
export type EscolhasIA = {
  /** O professor precisa escolher o conceito para aprovar. */
  exigirConceito: boolean;
  /** A IA não sugere conceito: ele vem em branco. */
  semSugestao: boolean;
  /** Pedir o motivo quando o professor muda o conceito sugerido. */
  pedirMotivo: boolean;
  /** O nome do aluno ou da equipe vira um código antes de ir para a IA. */
  nomeCodigo: boolean;
  /** E-mail, telefone, CPF e nomes do cadastro são escondidos no texto enviado à IA. */
  esconderDados: boolean;
};

export type LinhaEscolhas = {
  ia_exigir_conceito?: boolean | null;
  ia_sem_sugestao?: boolean | null;
  ia_pedir_motivo?: boolean | null;
  ia_nome_codigo?: boolean | null;
  ia_esconder_dados?: boolean | null;
};

export const COLUNAS_ESCOLHAS = "ia_exigir_conceito, ia_sem_sugestao, ia_pedir_motivo, ia_nome_codigo, ia_esconder_dados";

/** Padrões de uma conta nova (igual aos da migração): quem decide é o professor e os dados dos alunos ficam protegidos. */
export const ESCOLHAS_PADRAO: EscolhasIA = { exigirConceito: true, semSugestao: false, pedirMotivo: false, nomeCodigo: true, esconderDados: true };

export function resolverEscolhas(conta: LinhaEscolhas | null | undefined, turma?: LinhaEscolhas | null): EscolhasIA {
  const pega = (t: boolean | null | undefined, c: boolean | null | undefined, padrao: boolean) => t ?? c ?? padrao;
  return {
    exigirConceito: pega(turma?.ia_exigir_conceito, conta?.ia_exigir_conceito, ESCOLHAS_PADRAO.exigirConceito),
    semSugestao: pega(turma?.ia_sem_sugestao, conta?.ia_sem_sugestao, ESCOLHAS_PADRAO.semSugestao),
    pedirMotivo: pega(turma?.ia_pedir_motivo, conta?.ia_pedir_motivo, ESCOLHAS_PADRAO.pedirMotivo),
    nomeCodigo: pega(turma?.ia_nome_codigo, conta?.ia_nome_codigo, ESCOLHAS_PADRAO.nomeCodigo),
    esconderDados: pega(turma?.ia_esconder_dados, conta?.ia_esconder_dados, ESCOLHAS_PADRAO.esconderDados),
  };
}

/** Os nomes das colunas do banco para guardar as escolhas. */
export function colunasDasEscolhas(e: EscolhasIA) {
  return {
    ia_exigir_conceito: e.exigirConceito,
    ia_sem_sugestao: e.semSugestao,
    ia_pedir_motivo: e.pedirMotivo,
    ia_nome_codigo: e.nomeCodigo,
    ia_esconder_dados: e.esconderDados,
  };
}

/**
 * Registro de supervisão: por entrega, o que a IA sugeriu, o que o professor decidiu, o motivo, quem
 * aprovou e quando. Serve para provar que a decisão foi do professor (e para responder a um pedido de revisão).
 */
export type LinhaBruta = {
  grupo: string;
  etapaNumero: number;
  etapaTitulo: string;
  status: string;
  conceitoIa: string | null;
  conceito: string | null;
  escolhido: boolean;
  motivo: string;
  aprovadaEm: string | null;
  aprovadaPor: string | null;
  alertas: number;
};

export type LinhaSupervisao = {
  grupo: string;
  etapaNumero: number;
  etapaTitulo: string;
  situacao: "aprovada" | "revisar";
  conceitoIa: string | null;
  conceitoFinal: string | null;
  /** O conceito final é diferente do que a IA sugeriu. */
  mudou: boolean;
  /** O professor escolheu o conceito de próprio punho (e não só aceitou o que veio preenchido). */
  escolheu: boolean;
  motivo: string;
  aprovadaEm: string | null;
  aprovadaPor: string;
  alertas: number;
};

const CONCEITOS = ["EXCELENTE", "BOM", "REGULAR", "RUIM"];

export function montarSupervisao(brutas: LinhaBruta[], quemAprovou: (id: string | null) => string): LinhaSupervisao[] {
  return brutas
    .filter((b) => b.status === "aprovada" || b.status === "pronta")
    .map((b) => {
      const final = b.status === "aprovada" && b.conceito && CONCEITOS.includes(b.conceito) ? b.conceito : null;
      return {
        grupo: b.grupo,
        etapaNumero: b.etapaNumero,
        etapaTitulo: b.etapaTitulo,
        situacao: b.status === "aprovada" ? ("aprovada" as const) : ("revisar" as const),
        conceitoIa: b.conceitoIa && CONCEITOS.includes(b.conceitoIa) ? b.conceitoIa : null,
        conceitoFinal: final,
        mudou: Boolean(final && b.conceitoIa && final !== b.conceitoIa),
        escolheu: b.escolhido,
        motivo: b.motivo,
        aprovadaEm: b.status === "aprovada" ? b.aprovadaEm : null,
        aprovadaPor: b.status === "aprovada" ? quemAprovou(b.aprovadaPor) : "",
        alertas: b.alertas,
      };
    })
    .sort((a, b) => a.etapaNumero - b.etapaNumero || a.grupo.localeCompare(b.grupo, "pt-BR"));
}

export type ResumoSupervisao = { aprovadas: number; mudou: number; aceitou: number; aguardando: number };

export function resumoSupervisao(linhas: LinhaSupervisao[]): ResumoSupervisao {
  const aprovadas = linhas.filter((l) => l.situacao === "aprovada");
  return {
    aprovadas: aprovadas.length,
    mudou: aprovadas.filter((l) => l.mudou).length,
    aceitou: aprovadas.filter((l) => l.conceitoIa && !l.mudou).length,
    aguardando: linhas.length - aprovadas.length,
  };
}

/** Planilha não pode virar fórmula (=, +, -, @ no começo): prefixa com apóstrofo. */
function seguro(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const AVISO = "Contém dados pessoais dos alunos. Uso interno: não compartilhe fora da instituição.";

export function csvDaSupervisao(linhas: LinhaSupervisao[], turma: string, rotuloEtapa: string, rotuloGrupo: string, fmtData: (iso: string | null) => string): string {
  const cab = ["Turma", rotuloEtapa, "Título", rotuloGrupo, "Sugestão da IA", "Conceito final", "Mudou o conceito", "Escolhido pelo professor", "Motivo da mudança", "Aprovada em", "Aprovada por", "Alertas"];
  const cel = (v: string | number) => {
    const s = seguro(String(v));
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const corpo = linhas.map((l) => [
    turma,
    l.etapaNumero,
    l.etapaTitulo,
    l.grupo,
    l.conceitoIa ?? "",
    l.conceitoFinal ?? (l.situacao === "revisar" ? "aguardando revisão" : ""),
    l.situacao === "aprovada" ? (l.mudou ? "sim" : "não") : "",
    l.situacao === "aprovada" ? (l.escolheu ? "sim" : "aceitou a sugestão") : "",
    l.motivo,
    fmtData(l.aprovadaEm),
    l.aprovadaPor,
    l.alertas,
  ]);
  // Ponto e vírgula e BOM: o Excel em português abre certinho.
  return "﻿" + [cab, ...corpo].map((l) => l.map(cel).join(";")).join("\r\n") + `\r\n${cel(AVISO)}\r\n`;
}

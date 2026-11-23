/** Regras dos lembretes de prazo para os alunos (usadas pela tela e pelo envio diário). */
export type TipoLembrete = "abre" | "dois_dias" | "no_dia";
export type ConfigLembrete = { lembrete_abre: boolean; lembrete_dois_dias: boolean; lembrete_no_dia: boolean };
export type EtapaLembrete = { id: string; numero: number; titulo: string; recebe_de: string | null; recebe_ate: string | null };

export const NOME_LEMBRETE: Record<TipoLembrete, string> = { abre: "abre", dois_dias: "2 dias antes", no_dia: "no dia" };

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Em que dia sai cada lembrete ligado de uma etapa. */
export function diasDosLembretes(e: EtapaLembrete, c: ConfigLembrete): { tipo: TipoLembrete; dia: string }[] {
  const r: { tipo: TipoLembrete; dia: string }[] = [];
  if (c.lembrete_abre && e.recebe_de) r.push({ tipo: "abre", dia: e.recebe_de });
  if (c.lembrete_dois_dias && e.recebe_ate) r.push({ tipo: "dois_dias", dia: somarDias(e.recebe_ate, -2) });
  if (c.lembrete_no_dia && e.recebe_ate) r.push({ tipo: "no_dia", dia: e.recebe_ate });
  return r;
}

/** Próximos lembretes (de hoje em diante), em ordem. */
export function proximosLembretes(etapas: EtapaLembrete[], c: ConfigLembrete, hoje: string, limite = 5) {
  return etapas
    .flatMap((e) => diasDosLembretes(e, c).map((x) => ({ ...x, etapa: e })))
    .filter((x) => x.dia >= hoje)
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.etapa.numero - b.etapa.numero)
    .slice(0, limite);
}

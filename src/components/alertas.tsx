import { normalizarAlertas, ROTULO_ALERTA, ROTULO_GRAVIDADE, temAlertaCritico, type Alerta } from "@/lib/ia/alertas";

/**
 * Alertas de risco de uma entrega, para quem avalia olhar com mais atenção antes
 * de aprovar. Não bloqueia nada: o conceito continua sendo de quem avalia.
 * A gravidade aparece escrita (não só na cor).
 */
export function AlertasDaEntrega({ alertas, compacto = false }: { alertas: unknown; compacto?: boolean }) {
  const lista = normalizarAlertas(alertas);
  if (!lista.length) return null;
  const critico = temAlertaCritico(lista);
  return (
    <section
      role="note"
      aria-label="Alertas desta entrega"
      className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 text-sm ${critico ? "border-erro/30 bg-erro-fundo text-erro" : "border-alerta/30 bg-alerta-fundo text-alerta"}`}
    >
      <strong>{critico ? "Olhe esta entrega com cuidado antes de aprovar" : "Vale uma olhada antes de aprovar"}</strong>
      <ul className="flex flex-col gap-2">
        {lista.map((a) => (
          <li key={a.tipo} className="flex flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2 font-semibold">
              {ROTULO_ALERTA[a.tipo]}
              <span className="rounded-full border border-current px-2 py-px text-[11px] font-bold">{ROTULO_GRAVIDADE[a.gravidade]}</span>
            </span>
            <span className="[overflow-wrap:anywhere]">{a.texto}</span>
          </li>
        ))}
      </ul>
      {compacto ? null : <span className="text-xs">São avisos automáticos, só para você conferir: o conceito e a devolutiva continuam sendo seus.</span>}
    </section>
  );
}

/** Etiqueta pequena para listas ("2 alertas"). */
export function SeloAlertas({ quantidade, critico }: { quantidade: number; critico: boolean }) {
  if (!quantidade) return null;
  const texto = `${quantidade} ${quantidade === 1 ? "alerta" : "alertas"}`;
  return (
    <span
      title={critico ? "Tem alerta para olhar com cuidado" : "Tem alerta para conferir"}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${critico ? "bg-erro-fundo text-erro" : "bg-alerta-fundo text-alerta"}`}
    >
      <span aria-hidden>⚠</span>
      {texto}
    </span>
  );
}

/** Quantos alertas e se algum é grave (para as listas). */
export function resumoDosAlertas(alertas: unknown): { quantidade: number; critico: boolean } {
  const lista: Alerta[] = normalizarAlertas(alertas);
  return { quantidade: lista.length, critico: temAlertaCritico(lista) };
}

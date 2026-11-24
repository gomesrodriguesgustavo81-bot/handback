import type { ReactNode } from "react";

export type TomSelo = "ok" | "neutro" | "alerta" | "info";
const SELO: Record<TomSelo, string> = {
  ok: "bg-ok-fundo text-ok",
  neutro: "bg-neutro-fundo text-neutro",
  alerta: "bg-alerta-fundo text-alerta",
  info: "bg-info-fundo text-info",
};

/**
 * Bloco que abre e fecha, igual em todas as telas: título, resumo de uma
 * linha, selo de estado e o + que vira × ao abrir.
 */
export function BlocoAjuste({
  titulo,
  resumo,
  selo,
  tom = "neutro",
  aberto = false,
  children,
}: {
  titulo: string;
  resumo?: string;
  selo?: string;
  tom?: TomSelo;
  aberto?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={aberto} className="dobra group overflow-hidden rounded-2xl border border-borda bg-cartao">
      <summary className="toque flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{titulo}</span>
          {resumo ? <span className="truncate text-xs text-suave">{resumo}</span> : null}
        </span>
        {selo ? <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${SELO[tom]}`}>{selo}</span> : null}
        <span aria-hidden className="w-4 shrink-0 text-center text-lg text-suave transition-transform duration-[250ms] ease-[cubic-bezier(.2,.8,.2,1)] group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-borda/60 px-4 pt-3 pb-4 text-sm">{children}</div>
    </details>
  );
}

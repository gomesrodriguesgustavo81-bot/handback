"use client";

import Link from "next/link";

/** Barra acima das folhas (some na impressão). */
export function BarraRelatorio({ voltar }: { voltar: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
      <Link href={voltar} className="text-sm text-suave hover:text-texto">
        ← Relatórios
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-marca-forte px-4 font-semibold text-sobre-marca hover:bg-marca"
      >
        Imprimir ou salvar PDF
      </button>
    </div>
  );
}

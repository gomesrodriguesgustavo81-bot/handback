"use client";

import { useState, type ReactNode } from "react";

/** Bloco "Editar" que abre e fecha. Abre sozinho só na primeira vez; depois de salvar, não fecha de repente. */
export function DobraEditar({ abertoNoInicio, titulo, children }: { abertoNoInicio: boolean; titulo: string; children: ReactNode }) {
  const [aberto, setAberto] = useState(abertoNoInicio);
  return (
    <details id="editar" open={aberto} onToggle={(e) => setAberto(e.currentTarget.open)} className="dobra rounded-2xl border border-borda bg-cartao">
      <summary className="flex min-h-13 cursor-pointer items-center px-4 font-semibold">{titulo}</summary>
      <div className="border-t border-borda p-4">{children}</div>
    </details>
  );
}

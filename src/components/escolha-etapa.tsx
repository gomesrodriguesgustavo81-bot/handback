"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Lista de etapas (ciclos, encontros…) que troca o painel ao escolher. */
export function EscolhaEtapa({
  rotulo,
  atual,
  opcoes,
  base,
  detalhe,
}: {
  rotulo: string;
  atual: string;
  opcoes: { id: string; nome: string }[];
  base: string;
  detalhe: string;
}) {
  const router = useRouter();
  const [mudando, iniciar] = useTransition();
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-suave">{rotulo}</span>
      <select
        value={atual}
        disabled={mudando}
        onChange={(e) => {
          const id = e.target.value;
          iniciar(() => router.push(`${base}?etapa=${id}`));
        }}
        className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base font-semibold text-texto sm:max-w-md"
      >
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </select>
      <span className="text-sm text-suave">{mudando ? "Carregando…" : detalhe}</span>
    </label>
  );
}

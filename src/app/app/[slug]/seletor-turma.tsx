"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { escolherTurma } from "./turma-acoes";

/** Caixa para escolher a turma mostrada (cabe muitas turmas, também no celular). */
export function SeletorTurma({
  slug,
  rotulo,
  turmas,
  atual,
  criarHref,
}: {
  slug: string;
  rotulo: string;
  turmas: { id: string; nome: string }[];
  atual: string | null;
  criarHref: string | null;
}) {
  const router = useRouter();
  const [trocando, iniciar] = useTransition();
  return (
    <label className="flex max-w-md flex-col gap-1 print:hidden">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-suave">{rotulo}</span>
      <select
        name="turma"
        value={atual ?? ""}
        disabled={trocando}
        onChange={(e) => {
          const valor = e.target.value;
          if (valor === "__criar") {
            if (criarHref) router.push(criarHref);
            return;
          }
          iniciar(async () => {
            await escolherTurma(slug, valor);
            router.refresh();
          });
        }}
        className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base font-semibold text-texto disabled:opacity-60"
      >
        {turmas.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
        {criarHref ? <option value="__criar">+ Criar {rotulo.toLowerCase()}</option> : null}
      </select>
    </label>
  );
}

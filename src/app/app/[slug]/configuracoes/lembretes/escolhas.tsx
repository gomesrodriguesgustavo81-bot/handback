"use client";

import { useState, useTransition } from "react";
import { SinalSalvo, useSalvar } from "@/components/campo-auto";
import { salvarLembrete } from "./acoes";

export function CaixaLembrete({ slug, campo, nome, inicial }: { slug: string; campo: string; nome: string; inicial: boolean }) {
  const [marcado, setMarcado] = useState(inicial);
  const { salvar, estado, erro } = useSalvar(slug, campo, inicial ? "sim" : "nao", (v) => salvarLembrete(slug, campo, v));
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[15px]">
      <input
        type="checkbox"
        checked={marcado}
        onChange={(e) => {
          setMarcado(e.target.checked);
          salvar(e.target.checked ? "sim" : "nao");
        }}
        className="size-[22px] shrink-0 accent-[var(--marca)]"
      />
      <span className="flex flex-wrap items-center gap-2">
        {nome}
        <SinalSalvo estado={estado} erro={erro} />
      </span>
    </label>
  );
}

export function UsarMeuGmail({ slug }: { slug: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => iniciar(async () => void (await salvarLembrete(slug, "usar_meu_gmail", "sim")))}
      className="inline-flex min-h-11 items-center self-start rounded-xl border border-borda px-3 text-sm font-semibold text-marca-forte hover:bg-fundo disabled:opacity-60"
    >
      {pendente ? "Um momento…" : "Enviar pelo meu Gmail"}
    </button>
  );
}

"use client";
import { useConfirmar } from "@/components/confirmar";

import { useState, useTransition } from "react";
import { SinalSalvo, useSalvar } from "@/components/campo-auto";
import { salvarLembrete } from "./acoes";

export function CaixaLembrete({ slug, campo, nome, inicial }: { slug: string; campo: string; nome: string; inicial: boolean }) {
  const [marcado, setMarcado] = useState(inicial);
  const { salvar, estado, erro } = useSalvar(slug, campo, inicial ? "sim" : "nao", (v) => salvarLembrete(slug, campo, v));
  const { pedir, janela } = useConfirmar();
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[15px]">
      {janela}
      <input
        type="checkbox"
        checked={marcado}
        onChange={async (e) => {
          const ligar = e.target.checked;
          const ok = await pedir(
            ligar
              ? { titulo: `Ligar o lembrete “${nome.toLowerCase()}”?`, texto: "Os alunos que ainda não entregaram vão receber um e-mail às 9h, do seu Gmail.", sim: "Sim, ligar" }
              : { titulo: `Desligar o lembrete “${nome.toLowerCase()}”?`, sim: "Sim, desligar", perigo: true },
          );
          if (!ok) return;
          setMarcado(ligar);
          salvar(ligar ? "sim" : "nao");
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
  const { pedir, janela } = useConfirmar();
  return (
    <>
    {janela}
    <button
      type="button"
      disabled={pendente}
      onClick={async () => {
        if (await pedir({ titulo: "Enviar os lembretes pelo seu Gmail?", texto: "Os alunos passam a receber os lembretes do seu endereço.", sim: "Sim, usar o meu" }))
          iniciar(async () => void (await salvarLembrete(slug, "usar_meu_gmail", "sim")));
      }}
      className="inline-flex min-h-11 items-center self-start rounded-xl border border-borda px-3 text-sm font-semibold text-marca-forte hover:bg-fundo disabled:opacity-60"
    >
      {pendente ? "Um momento…" : "Enviar pelo meu Gmail"}
    </button>
    </>
  );
}

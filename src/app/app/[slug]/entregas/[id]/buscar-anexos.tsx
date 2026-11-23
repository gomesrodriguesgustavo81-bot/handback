"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirmar } from "@/components/confirmar";
import { buscarAnexosDeNovo } from "../acoes";

/** Botão "Buscar o anexo de novo" (quando o e-mail tinha anexo que não foi guardado). */
export function BuscarAnexos({ slug, entregaId }: { slug: string; entregaId: string }) {
  const [msg, setMsg] = useState("");
  const [indo, iniciar] = useTransition();
  const { pedir, janela } = useConfirmar();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={indo}
        onClick={async () => {
          if (!(await pedir({ titulo: "Buscar o anexo de novo?", texto: "O Handback busca o arquivo no e-mail original e junta a esta entrega.", sim: "Sim, buscar" }))) return;
          iniciar(async () => {
            const r = await buscarAnexosDeNovo(slug, entregaId);
            setMsg(r.mensagem);
            router.refresh();
          });
        }}
        className="inline-flex min-h-11 items-center self-start rounded-xl border border-current px-3 font-semibold disabled:opacity-60"
      >
        {indo ? "Buscando…" : "Buscar o anexo de novo"}
      </button>
      {msg ? <p role="status">{msg}</p> : null}
      {janela}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useConfirmar } from "@/components/confirmar";
import { Aviso, Botao } from "@/components/ui";
import { lembrarQuemNaoEntregou } from "../acoes";

/** Botão "Lembrar quem não entregou (N)" no passo Receber. */
export function LembrarQuemFalta({ slug, etapaId, faltam }: { slug: string; etapaId: string; faltam: number }) {
  const { pedir, janela } = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; mensagem: string } | null>(null);
  if (!faltam) return null;
  return (
    <div className="flex flex-col gap-2">
      <Botao
        type="button"
        variante="secundario"
        className="self-start text-sm"
        disabled={pendente}
        onClick={async () => {
          if (
            !(await pedir({
              titulo: `Lembrar ${faltam === 1 ? "quem não entregou" : `os ${faltam} que não entregaram`}?`,
              texto: "Sai um e-mail do seu Gmail só para quem ainda não entregou, com o prazo e o que entregar. No máximo um por dia.",
              sim: "Sim, lembrar",
            }))
          )
            return;
          iniciar(async () => setMsg(await lembrarQuemNaoEntregou(slug, etapaId)));
        }}
      >
        {pendente ? (
          <>
            <span aria-hidden className="rodinha" />
            Mandando…
          </>
        ) : (
          `Lembrar quem não entregou (${faltam})`
        )}
      </Botao>
      {janela}
      {msg ? <Aviso tipo={msg.ok ? "info" : "erro"}>{msg.mensagem}</Aviso> : null}
    </div>
  );
}

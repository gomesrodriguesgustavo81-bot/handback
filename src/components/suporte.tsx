"use client";
import { useConfirmar } from "./confirmar";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cortarSuporte, liberarSuporte } from "@/app/app/[slug]/configuracoes/acoes";
import { Aviso, Botao } from "./ui";

/** Liberar ou cortar o acesso de suporte do Handback (só quem administra o espaço). */
export function ControleSuporte({
  slug,
  ativo,
}: {
  slug: string;
  ativo: { tipo: "suporte" | "emergencia"; ate: string; motivo: string } | null;
}) {
  const router = useRouter();
  const [dias, setDias] = useState(3);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState("");
  const { pedir, janela } = useConfirmar();
  const fazer = (f: () => Promise<{ ok: boolean; mensagem: string }>) =>
    iniciar(async () => {
      const r = await f();
      setErro(r.ok ? "" : r.mensagem);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      {ativo ? (
        <>
          <div className="entra flex flex-col gap-1 rounded-xl bg-acento px-3 py-2.5 text-sm font-semibold text-sobre-acento">
            <span>
              {ativo.tipo === "emergencia" ? "Acesso de emergência" : "Suporte liberado"} até {ativo.ate}. Depois disso, fecha sozinho.
            </span>
            {ativo.motivo ? <span className="font-normal">Motivo: {ativo.motivo}</span> : null}
          </div>
          <button
            type="button"
            disabled={pendente}
            onClick={async () => {
              if (await pedir({ titulo: "Cortar o acesso do suporte agora?", texto: "A equipe do Handback deixa de ver o conteúdo na hora.", sim: "Sim, cortar", perigo: true })) fazer(() => cortarSuporte(slug));
            }}
            className="min-h-11 rounded-full border border-erro/40 bg-cartao px-4 font-medium text-erro hover:bg-erro-fundo disabled:opacity-60"
          >
            {pendente ? "Cortando…" : "Cortar agora"}
          </button>
        </>
      ) : (
        <div className="entra flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Por quanto tempo?</span>
            <select
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
            >
              <option value={1}>1 dia</option>
              <option value={3}>3 dias</option>
              <option value={7}>7 dias</option>
            </select>
          </label>
          <Botao type="button" disabled={pendente} onClick={async () => {
              if (await pedir({ titulo: `Liberar o suporte por ${dias === 1 ? "1 dia" : `${dias} dias`}?`, texto: "A equipe do Handback passa a ver as entregas e devolutivas deste espaço. Tudo fica no registro, e você pode cortar quando quiser.", sim: "Sim, liberar" })) fazer(() => liberarSuporte(slug, dias));
            }}>
            {pendente ? "Liberando…" : "Liberar o acesso de suporte"}
          </Botao>
        </div>
      )}
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {janela}
    </div>
  );
}

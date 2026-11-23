"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirmar } from "@/components/confirmar";
import { Aviso } from "@/components/ui";
import { ligarDrive, salvarAntigos } from "./acoes";

export function LigarDrive({ slug, ligado, podeLigar, deOutro }: { slug: string; ligado: boolean; podeLigar: boolean; deOutro: string | null }) {
  const router = useRouter();
  const { pedir, janela } = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; mensagem: string } | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <label className={`flex min-h-12 items-center justify-between gap-3 ${podeLigar || ligado ? "cursor-pointer" : "opacity-60"}`}>
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">Guardar os arquivos no meu Drive</span>
          <span className="text-xs text-suave">As entregas desta turma vão para uma pasta sua, em vez do espaço do Handback.</span>
        </span>
        <input
          type="checkbox"
          checked={ligado}
          disabled={pendente || (!podeLigar && !ligado)}
          onChange={async (e) => {
            const ligar = e.target.checked;
            const ok = await pedir(
              ligar
                ? {
                    titulo: deOutro ? "Passar os arquivos novos para o seu Drive?" : "Guardar os arquivos no seu Drive?",
                    texto: `O Handback cria as pastas Handback › turma › equipe no seu Google Drive e leva para lá os arquivos das entregas.${deOutro ? ` Os que já estão no Drive de ${deOutro} continuam lá.` : ""}`,
                    sim: "Sim, guardar no Drive",
                  }
                : { titulo: "Parar de levar para o Drive?", texto: "As entregas novas ficam no Handback. As que já estão no seu Drive continuam lá.", sim: "Sim, parar", perigo: true },
            );
            if (!ok) return;
            iniciar(async () => {
              setMsg(await ligarDrive(slug, ligar));
              router.refresh();
            });
          }}
          className="size-6 shrink-0 accent-[var(--marca)]"
        />
      </label>
      {msg ? <Aviso tipo={msg.ok ? "info" : "erro"}>{msg.mensagem}</Aviso> : null}
      {janela}
    </div>
  );
}

export function Antigos({ slug, mover }: { slug: string; mover: boolean }) {
  const router = useRouter();
  const { pedir, janela } = useConfirmar();
  const [valor, setValor] = useState(mover);
  const [, iniciar] = useTransition();
  const opcao = (v: boolean, nome: string, detalhe: string) => (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 border-t border-borda py-1 text-sm first-of-type:border-t-0">
      <input
        type="radio"
        name="antigos"
        checked={valor === v}
        onChange={async () => {
          const ok = await pedir(
            v
              ? { titulo: "Levar também os arquivos antigos?", texto: "Os arquivos que já estão no Handback vão para o seu Drive aos poucos e saem daqui, liberando espaço.", sim: "Sim, levar" }
              : { titulo: "Deixar os arquivos antigos no Handback?", texto: "Só as entregas novas vão para o Drive.", sim: "Sim, deixar" },
          );
          if (!ok) return;
          setValor(v);
          iniciar(async () => {
            await salvarAntigos(slug, v);
            router.refresh();
          });
        }}
        className="size-5 shrink-0 accent-[var(--marca)]"
      />
      <span className="flex flex-col">
        {nome}
        <span className="text-xs text-suave">{detalhe}</span>
      </span>
    </label>
  );
  return (
    <section aria-label="Arquivos antigos" className="flex flex-col rounded-2xl border border-borda bg-cartao p-4">
      <h2 className="mb-1 font-semibold">Os arquivos que já estão no Handback</h2>
      {opcao(true, "Levar para o Drive também", "Libera o espaço do Handback (vai aos poucos)")}
      {opcao(false, "Deixar onde estão", "Só as entregas novas vão para o Drive")}
      {janela}
    </section>
  );
}

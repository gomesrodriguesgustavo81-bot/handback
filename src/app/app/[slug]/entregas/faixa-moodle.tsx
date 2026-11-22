"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Aviso, Botao } from "@/components/ui";
import { buscarNoMoodle, marcarTarefa } from "../moodle/acoes";

type Tarefa = { id: string; nome: string; detalhe: string; corrigir: boolean };

/** Faixa da turma ligada ao Moodle: quando olhou por último, buscar agora e quais tarefas o Handback corrige. */
export function FaixaMoodle({
  slug,
  disciplina,
  ultimaBusca,
  erro,
  tarefas,
  podeMarcar,
  ajustesHref,
}: {
  slug: string;
  disciplina: string;
  ultimaBusca: string;
  erro: string;
  tarefas: Tarefa[];
  podeMarcar: boolean;
  ajustesHref: string | null;
}) {
  const router = useRouter();
  const [buscando, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [marcadas, setMarcadas] = useState(() => Object.fromEntries(tarefas.map((t) => [t.id, t.corrigir])));
  const [salvando, iniciarSalvar] = useTransition();

  return (
    <section aria-label="Moodle" className="flex flex-col gap-3 rounded-2xl bg-alerta-fundo p-4 sm:max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-alerta">
            <path d="M22 10L12 5 2 10l10 5 10-5z" />
            <path d="M6 12v5c3 2 9 2 12 0v-5" />
          </svg>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-texto [overflow-wrap:anywhere]">Ligada ao Moodle · {disciplina}</span>
            <span className="text-xs text-suave">{ultimaBusca}</span>
          </span>
        </div>
        <Botao
          type="button"
          variante="secundario"
          disabled={buscando}
          className="w-full sm:w-auto"
          onClick={() =>
            iniciar(async () => {
              setMsg(null);
              setMsg(await buscarNoMoodle(slug));
              router.refresh();
            })
          }
        >
          {buscando ? "Buscando no Moodle…" : "Buscar entregas agora"}
        </Botao>
      </div>
      {msg ? <Aviso tipo={msg.ok ? "info" : "erro"}>{msg.mensagem}</Aviso> : erro ? (
        <Aviso tipo="erro">
          A última busca no Moodle falhou: {erro}{" "}
          {ajustesHref ? (
            <a href={ajustesHref} className="font-semibold underline">
              Ligar de novo
            </a>
          ) : null}
        </Aviso>
      ) : null}
      {tarefas.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-texto">Tarefas do Moodle que o Handback corrige</summary>
          <p className="mt-1 text-xs text-suave">Desmarque as que não são para corrigir (fóruns, avisos…). As outras ele deixa quietas.</p>
          <ul className="mt-2 flex flex-col divide-y divide-borda rounded-xl border border-borda bg-cartao">
            {tarefas.map((t) => (
              <li key={t.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={marcadas[t.id]}
                    disabled={!podeMarcar || salvando}
                    onChange={(e) => {
                      const valor = e.target.checked;
                      setMarcadas((m) => ({ ...m, [t.id]: valor }));
                      iniciarSalvar(async () => {
                        const r = await marcarTarefa(slug, t.id, valor);
                        if (!r.ok) {
                          setMarcadas((m) => ({ ...m, [t.id]: !valor }));
                          setMsg(r);
                        }
                        router.refresh();
                      });
                    }}
                    className="size-5 shrink-0 accent-[var(--marca)]"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{t.nome}</span>
                    <span className="text-xs text-suave">{t.detalhe}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${marcadas[t.id] ? "bg-marca-clara text-marca-forte" : "bg-neutro-fundo text-neutro"}`}>
                    {marcadas[t.id] ? "Corrigindo" : "Fora"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

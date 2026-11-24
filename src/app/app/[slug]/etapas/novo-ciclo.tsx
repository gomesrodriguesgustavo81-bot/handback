"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** "+ Novo ciclo": uma gaveta com os jeitos de começar (escrever ou ler do plano de ensino). */
export function NovoCiclo({ slug, etapa, classroom }: { slug: string; etapa: string; classroom: boolean }) {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);
  const minusc = etapa.charAt(0).toLowerCase() + etapa.slice(1);
  const opcao = "toque flex min-h-16 items-center gap-3 rounded-xl border border-borda bg-cartao px-3 py-2 hover:border-marca";
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-haspopup="dialog"
        className="toque inline-flex min-h-11 items-center justify-center rounded-xl bg-marca px-4 font-semibold text-sobre-marca hover:bg-marca-forte"
      >
        + Nov{/a$/i.test(etapa) ? "a" : "o"} {minusc}
      </button>
      {aberto ? (
        <div className="escurece fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onClick={() => setAberto(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Nov${/a$/i.test(etapa) ? "a" : "o"} ${minusc}`}
            onClick={(e) => e.stopPropagation()}
            className="sobe flex w-full max-w-md flex-col gap-2.5 rounded-t-3xl bg-cartao px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5"
          >
            <span aria-hidden className="mb-1 h-1 w-10 self-center rounded-full bg-borda sm:hidden" />
            <h2 className="text-xl font-bold">
              Nov{/a$/i.test(etapa) ? "a" : "o"} {minusc}
            </h2>
            <p className="text-sm text-suave">Escolha como começar.{classroom ? " Dá para publicar no Classroom na próxima tela." : ""}</p>
            <Link href={`/app/${slug}/etapas/nova`} className={opcao}>
              <span className="flex flex-col">
                <span className="font-semibold">Escrever {/a$/i.test(etapa) ? "a" : "o"} {minusc}</span>
                <span className="text-[13px] text-suave">Título, prazo e o que deve ser entregue.</span>
              </span>
            </Link>
            <Link href={`/app/${slug}/etapas/plano`} className={opcao}>
              <span className="flex flex-col">
                <span className="font-semibold">Ler do plano de ensino</span>
                <span className="text-[13px] text-suave">A IA monta tudo do semestre para você revisar.</span>
              </span>
            </Link>
            <button type="button" onClick={() => setAberto(false)} className="toque mt-1 min-h-11 rounded-xl border border-borda font-medium">
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

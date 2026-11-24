"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Assistente dentro de um formulário: uma pergunta por tela, com "Passo X de
 * N", Voltar e Continuar. Todos os campos continuam no formulário (só ficam
 * escondidos), e o botão de salvar só aparece no último passo.
 */
export function PassosDoForm({ passos }: { passos: { titulo: string; conteudo: ReactNode }[] }) {
  const [atual, setAtual] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const ultimo = atual === passos.length - 1;
  useEffect(() => {
    const form = raiz.current?.closest("form");
    if (form) form.dataset.ultimo = ultimo ? "sim" : "nao";
  }, [ultimo]);
  const avancar = () => {
    // Só deixa seguir com os campos obrigatórios deste passo preenchidos.
    const campos = raiz.current?.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(`[data-passo="${atual}"] input, [data-passo="${atual}"] textarea, [data-passo="${atual}"] select`);
    for (const c of campos ?? []) if (!c.reportValidity()) return;
    setAtual((x) => Math.min(x + 1, passos.length - 1));
    raiz.current?.scrollIntoView({ block: "nearest" });
  };
  return (
    <div
      ref={raiz}
      className="flex flex-col gap-4"
      onKeyDown={(e) => {
        // Enter num campo leva ao próximo passo, em vez de salvar pela metade.
        if (e.key === "Enter" && !ultimo && (e.target as HTMLElement).tagName === "INPUT") {
          e.preventDefault();
          avancar();
        }
      }}
    >
      <div className="flex flex-col gap-2">
        <span aria-hidden className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${passos.length}, minmax(0, 1fr))` }}>
          {passos.map((p, i) => (
            <span key={p.titulo} className={`h-1.5 rounded-full transition-colors ${i < atual ? "bg-ok" : i === atual ? "bg-marca" : "bg-borda"}`} />
          ))}
        </span>
        <p aria-live="polite" className="text-xs font-bold uppercase tracking-wider text-marca">
          Passo {atual + 1} de {passos.length} · {passos[atual].titulo}
        </p>
      </div>
      {passos.map((p, i) => (
        <div key={p.titulo} data-passo={i} hidden={i !== atual} className="entra flex flex-col gap-4">
          {p.conteudo}
        </div>
      ))}
      <div className="flex gap-2">
        {atual > 0 ? (
          <button type="button" onClick={() => setAtual((x) => x - 1)} className="toque min-h-12 rounded-xl border border-borda bg-cartao px-4 font-semibold">
            ← Voltar
          </button>
        ) : null}
        {!ultimo ? (
          <button type="button" onClick={avancar} className="toque min-h-12 flex-1 rounded-xl bg-marca px-4 font-bold text-sobre-marca">
            Continuar
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Só a barrinha "Passo X de N" (para assistentes feitos de páginas separadas). */
export function BarraDePassos({ atual, total, titulo }: { atual: number; total: number; titulo: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span aria-hidden className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`h-1.5 rounded-full ${i + 1 < atual ? "bg-ok" : i + 1 === atual ? "bg-marca" : "bg-borda"}`} />
        ))}
      </span>
      <p className="text-xs font-bold uppercase tracking-wider text-marca">
        Passo {atual} de {total} · {titulo}
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CONCEITOS_REVISAO, ESTILO_CONCEITO } from "@/components/conceito";
import { Aviso } from "@/components/ui";
import { revisarDevolutiva } from "../acoes";

const SIMBOLO: Record<string, string> = { ENTREGUE: "✓", PARCIAL: "~", NAO_ENTREGUE: "✗" };

/** Uma entrega por tela: conceito, devolutiva e "Aprovar e próxima". */
export function RevisarUma({
  slug,
  entregaId,
  conceitoIa,
  conceito,
  devolutiva,
  justificativa,
  checklist,
  arquivos,
  links,
  completa,
  pularHref,
}: {
  slug: string;
  entregaId: string;
  conceitoIa: string | null;
  conceito: string;
  devolutiva: string;
  justificativa: string;
  checklist: { item: string; status: string }[];
  arquivos: { nome: string; href: string }[];
  links: string[];
  completa: string;
  pularHref: string | null;
}) {
  const [escolhido, setEscolhido] = useState(conceito);
  const [texto, setTexto] = useState(devolutiva);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [indo, iniciar] = useTransition();
  const router = useRouter();

  const aprovar = () => {
    const dados = new FormData();
    dados.set("acao", "aprovar");
    dados.set("conceito", escolhido);
    dados.set("devolutiva", texto);
    dados.set("motivo", motivo);
    setErro("");
    iniciar(async () => {
      const r = await revisarDevolutiva(slug, entregaId, null, dados);
      if (r?.ok) router.refresh();
      else setErro(r?.mensagem ?? "Não foi possível aprovar.");
    });
  };

  return (
    <div className="flex flex-col gap-3 pb-32 lg:pb-0">
      {checklist.length ? (
        <section aria-label="Checklist" className="flex flex-col gap-1 rounded-2xl border border-borda bg-cartao p-3 text-sm">
          {checklist.map((c, i) => (
            <span key={i} className="flex items-start gap-2">
              <span aria-hidden className={`w-4 shrink-0 text-center font-bold ${c.status === "ENTREGUE" ? "text-ok" : c.status === "PARCIAL" ? "text-reg" : "text-ruim"}`}>
                {SIMBOLO[c.status] ?? "•"}
              </span>
              <span>{c.item}</span>
            </span>
          ))}
          {justificativa ? <p className="mt-1 border-t border-borda pt-2 text-xs text-suave">{justificativa}</p> : null}
        </section>
      ) : null}

      {arquivos.length || links.length ? (
        <div className="flex flex-wrap gap-1.5">
          {arquivos.map((f) => (
            <a key={f.href} href={f.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 max-w-full items-center rounded-lg border border-borda bg-cartao px-2.5 text-sm hover:border-marca">
              <span className="truncate">{f.nome}</span>
            </a>
          ))}
          {links.map((l) => (
            <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 max-w-full items-center rounded-lg border border-borda bg-cartao px-2.5 text-sm hover:border-marca">
              <span className="truncate">{l.replace(/^https?:\/\//, "")}</span>
            </a>
          ))}
        </div>
      ) : null}

      <section aria-label="Conceito" className="flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between text-xs text-suave">
          <span className="font-semibold uppercase tracking-wide">Conceito</span>
          {conceitoIa ? (
            <span>
              IA sugeriu <strong className="text-texto">{conceitoIa}</strong>
            </span>
          ) : null}
        </span>
        <div role="radiogroup" aria-label="Conceito" className="grid grid-cols-4 gap-1">
          {CONCEITOS_REVISAO.map((c) => {
            const marcado = c === escolhido;
            const e = ESTILO_CONCEITO[c];
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={marcado}
                onClick={() => setEscolhido(c)}
                className={`min-h-12 rounded-[10px] text-[11.5px] font-bold tracking-wide sm:text-sm ${marcado ? `border-2 ${e.borda} ${e.fundo} ${e.texto}` : "border border-borda bg-cartao text-suave"}`}
              >
                {c}
              </button>
            );
          })}
        </div>
        {conceitoIa && escolhido !== conceitoIa ? (
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            placeholder={`Por que ${escolhido} e não ${conceitoIa}? (opcional, a IA aprende)`}
            aria-label="Motivo da mudança"
            className="min-h-11 rounded-xl border border-borda bg-cartao px-3 text-base text-texto placeholder:text-suave"
          />
        ) : null}
      </section>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-suave">Devolutiva</span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={10000}
          className="min-h-40 w-full rounded-xl border border-borda bg-cartao px-3 py-2.5 text-base leading-relaxed text-texto [field-sizing:content]"
        />
      </label>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

      {/* No celular, os botões ficam presos em cima da barra de baixo, sempre à mão. */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-borda bg-cartao/95 px-4 py-2.5 backdrop-blur lg:static lg:rounded-2xl lg:border">
        <div className="mx-auto flex max-w-xl gap-2">
          {pularHref ? (
            <Link href={pularHref} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-borda px-4 font-semibold">
              Pular
            </Link>
          ) : null}
          <button
            type="button"
            onClick={aprovar}
            disabled={indo || texto.trim().length < 2}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-marca px-4 font-bold text-sobre-marca disabled:opacity-60"
          >
            {indo ? "Aprovando…" : "Aprovar e próxima"}
          </button>
        </div>
        <Link href={completa} className="mx-auto mt-1 block max-w-xl text-center text-xs font-medium text-marca-forte underline">
          Abrir a entrega completa
        </Link>
      </div>
    </div>
  );
}

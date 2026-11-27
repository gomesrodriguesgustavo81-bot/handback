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
  exigirConceito = true,
  pedirMotivo = false,
  conceitoEscolhido = false,
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
  exigirConceito?: boolean;
  pedirMotivo?: boolean;
  conceitoEscolhido?: boolean;
}) {
  // Quando a escolha é exigida, nada vem marcado: a sugestão da IA é só rascunho.
  const [escolhido, setEscolhido] = useState(exigirConceito && !conceitoEscolhido ? "" : conceito);
  const [tocou, setTocou] = useState(false);
  const [texto, setTexto] = useState(devolutiva);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");
  const [indo, iniciar] = useTransition();
  const router = useRouter();

  const aprovar = () => {
    const dados = new FormData();
    dados.set("acao", "aprovar");
    dados.set("conceito", escolhido || conceito);
    dados.set("escolhido", tocou || conceitoEscolhido ? "1" : "0");
    dados.set("devolutiva", texto);
    dados.set("motivo", motivo);
    setErro("");
    iniciar(async () => {
      const r = await revisarDevolutiva(slug, entregaId, null, dados);
      if (r?.ok) router.refresh();
      else setErro(r?.mensagem ?? "Não foi possível aprovar.");
    });
  };

  const mudou = Boolean(conceitoIa) && escolhido !== "" && escolhido !== conceitoIa;
  const bloqueio =
    exigirConceito && (!escolhido || escolhido === "PENDENTE")
      ? "Escolha o conceito para poder aprovar."
      : pedirMotivo && mudou && !motivo.trim()
        ? "Diga o motivo de ter mudado o conceito."
        : "";

  return (
    <div className="flex flex-col gap-3 pb-40 lg:pb-0">
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
            <span className={exigirConceito ? "rounded-lg border border-dashed border-borda px-2 py-0.5" : ""}>
              {exigirConceito ? "Sugestão da IA (rascunho): " : "IA sugeriu "}
              <strong className="text-texto">{conceitoIa}</strong>
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
                onClick={() => {
                  setEscolhido(c);
                  setTocou(true);
                }}
                className={`min-h-12 rounded-[10px] text-[11.5px] font-bold tracking-wide sm:text-sm ${marcado ? `border-2 ${e.borda} ${e.fundo} ${e.texto}` : "border border-borda bg-cartao text-suave"}`}
              >
                {c}
              </button>
            );
          })}
        </div>
        {conceitoIa && escolhido !== "" && escolhido !== conceitoIa ? (
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={500}
            placeholder={`Por que ${escolhido} e não ${conceitoIa}? (${pedirMotivo ? "obrigatório" : "opcional, a IA aprende"})`}
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
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : bloqueio ? <p role="status" className="text-xs font-semibold text-alerta">{bloqueio}</p> : null}

      {/* No celular, os botões ficam presos em cima da barra de baixo, sempre à mão. */}
      <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 rounded-2xl border border-borda bg-cartao/95 px-4 py-2.5 shadow-lg backdrop-blur lg:static lg:shadow-none">
        <div className="mx-auto flex max-w-xl gap-2">
          {pularHref ? (
            <Link href={pularHref} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-borda px-3.5 font-semibold">
              Pular
            </Link>
          ) : null}
          <Link
            href={completa}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-borda px-3.5 font-semibold text-marca-forte"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
            Ver entrega
          </Link>
          <button
            type="button"
            onClick={aprovar}
            disabled={indo || texto.trim().length < 2 || Boolean(bloqueio)}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-marca px-4 font-bold text-sobre-marca disabled:opacity-60"
          >
            {indo ? "Aprovando…" : "Aprovar e próxima"}
          </button>
        </div>
      </div>
    </div>
  );
}

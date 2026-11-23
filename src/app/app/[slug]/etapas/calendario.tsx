"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type EtapaNoCalendario = {
  id: string;
  rotulo: string;
  recebe_de: string | null;
  recebe_ate: string | null;
  data: string | null;
  entregaram: number;
  /** Quantos cadastros a turma desta etapa tem (para "3 de 8 já entregaram"). */
  grupos?: number;
  /** Turma da etapa (no calendário de todas as turmas). */
  turma?: { id: string; nome: string };
};

type Evento = { etapa: EtapaNoCalendario; tipo: "abre" | "vence" | "aula" };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const SEMANA_NOME = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const iso = (a: number, m: number, d: number) => `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const ESTILO: Record<Evento["tipo"], { nome: string; ponto: string; selo: string }> = {
  abre: { nome: "Abre", ponto: "bg-ok", selo: "bg-ok-fundo text-ok" },
  vence: { nome: "Vence", ponto: "bg-reg", selo: "bg-reg-fundo text-reg" },
  aula: { nome: "Dia", ponto: "bg-info", selo: "bg-info-fundo text-info" },
};

/** Mês com o que abre e o que vence em cada dia. Toque num dia para ver o que tem nele. */
export function Calendario({
  slug,
  etapas: todas,
  hoje,
  grupos = 0,
  palavraEtapa,
  turmas = [],
  agenda,
}: {
  slug: string;
  etapas: EtapaNoCalendario[];
  hoje: string;
  grupos?: number;
  palavraEtapa: string;
  /** Com mais de uma, aparece o filtro por turma. */
  turmas?: { id: string; nome: string }[];
  /** Link para ligar o Google Agenda. */
  agenda?: string | null;
}) {
  const [ano0, mes0] = hoje.split("-").map(Number);
  const [mes, setMes] = useState({ ano: ano0, mes: mes0 - 1 });
  const [dia, setDia] = useState(hoje);
  const [filtro, setFiltro] = useState<string | null>(null);
  const etapas = useMemo(() => (filtro ? todas.filter((e) => e.turma?.id === filtro) : todas), [todas, filtro]);

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    const por = (d: string | null, e: Evento) => {
      if (!d) return;
      const k = d.slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), e]);
    };
    for (const e of etapas) {
      por(e.recebe_de, { etapa: e, tipo: "abre" });
      por(e.recebe_ate, { etapa: e, tipo: "vence" });
      if (e.data && e.data !== e.recebe_de && e.data !== e.recebe_ate) por(e.data, { etapa: e, tipo: "aula" });
    }
    return m;
  }, [etapas]);

  const primeiro = new Date(Date.UTC(mes.ano, mes.mes, 1)).getUTCDay();
  const dias = new Date(Date.UTC(mes.ano, mes.mes + 1, 0)).getUTCDate();
  const casas: (number | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  while (casas.length % 7) casas.push(null);

  const mudarMes = (passo: number) =>
    setMes((x) => {
      const n = x.mes + passo;
      return { ano: x.ano + Math.floor(n / 12), mes: ((n % 12) + 12) % 12 };
    });

  const eventos = porDia.get(dia) ?? [];
  const [, mD, dD] = dia.split("-").map(Number);
  const semanaD = new Date(`${dia}T12:00:00Z`).getUTCDay();

  return (
    <div className="entra flex flex-col gap-3 sm:max-w-md">
      {turmas.length > 1 ? (
        <div role="group" aria-label="Turmas" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ id: null as string | null, nome: "Todas as turmas" }, ...turmas].map((t) => (
            <button
              key={t.id ?? "todas"}
              type="button"
              aria-pressed={filtro === t.id}
              onClick={() => setFiltro(t.id)}
              className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                filtro === t.id ? "bg-marca-forte text-sobre-marca dark:bg-acento dark:text-sobre-acento" : "border border-borda bg-cartao text-texto hover:bg-fundo"
              }`}
            >
              {t.nome}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Mês anterior" onClick={() => mudarMes(-1)} className="flex size-11 items-center justify-center rounded-xl text-xl hover:bg-cartao">
          ‹
        </button>
        <h3 aria-live="polite" className="titulo text-lg font-extrabold">
          {MESES[mes.mes][0].toUpperCase() + MESES[mes.mes].slice(1)} de {mes.ano}
        </h3>
        <button type="button" aria-label="Próximo mês" onClick={() => mudarMes(1)} className="flex size-11 items-center justify-center rounded-xl text-xl hover:bg-cartao">
          ›
        </button>
      </div>
      <div aria-hidden className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-suave">
        {SEMANA.map((s, i) => (
          <span key={i}>{s}</span>
        ))}
      </div>
      <div role="grid" aria-label="Dias do mês" className="grid grid-cols-7 gap-1">
        {casas.map((d, i) => {
          if (!d) return <span key={i} />;
          const k = iso(mes.ano, mes.mes, d);
          const ev = porDia.get(k) ?? [];
          const escolhido = k === dia;
          const ehHoje = k === hoje;
          const tipos = [...new Set(ev.map((e) => e.tipo))];
          return (
            <button
              key={i}
              type="button"
              aria-pressed={escolhido}
              aria-label={`${d} de ${MESES[mes.mes]}${ehHoje ? ", hoje" : ""}${ev.length ? `, ${ev.map((e) => ESTILO[e.tipo].nome.toLowerCase()).join(" e ")}` : ""}`}
              onClick={() => setDia(k)}
              className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl text-sm transition-colors ${
                escolhido ? "bg-marca-forte font-bold text-sobre-marca dark:bg-acento dark:text-sobre-acento" : ehHoje ? "border-2 border-texto bg-cartao font-bold" : "bg-cartao hover:bg-marca-clara"
              }`}
            >
              <span>{d}</span>
              <span className="flex h-1.5 gap-0.5">
                {tipos.map((t) => (
                  <span key={t} className={`size-1.5 rounded-full ${ESTILO[t].ponto}`} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-ok" />Abre</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-reg" />Vence</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-info" />Dia d{/a$|ção$/i.test(palavraEtapa) ? "a" : "o"} {palavraEtapa.toLowerCase()}</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full border-2 border-texto" />Hoje</span>
      </div>
      <section aria-label="Dia escolhido" className="flex flex-col gap-2">
        <h4 className="font-semibold">
          {SEMANA_NOME[semanaD][0].toUpperCase() + SEMANA_NOME[semanaD].slice(1)}, {dD} de {MESES[mD - 1]}
          {dia === hoje ? " · Hoje" : ""}
        </h4>
        {eventos.length ? (
          eventos.map((e) => (
            <Link
              key={`${e.etapa.id}-${e.tipo}`}
              href={`/app/${slug}/etapas/${e.etapa.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-borda bg-cartao px-4 py-3 hover:border-marca"
            >
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{e.etapa.rotulo}</span>
                {e.etapa.turma && turmas.length > 1 ? <span className="text-xs font-medium text-marca-forte">{e.etapa.turma.nome}</span> : null}
                <span className="text-xs text-suave">
                  {e.tipo === "abre"
                    ? "Começa a receber entregas"
                    : e.tipo === "vence"
                      ? `Prazo de entrega${(e.etapa.grupos ?? grupos) ? ` · ${e.etapa.entregaram} de ${e.etapa.grupos ?? grupos} já entregaram` : ""}`
                      : "Dia marcado"}
                </span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${ESTILO[e.tipo].selo}`}>{ESTILO[e.tipo].nome}</span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-suave">Nada neste dia.</p>
        )}
      </section>
      {agenda ? (
        <Link href={agenda} className="flex items-center gap-2.5 rounded-2xl border border-dashed border-borda px-4 py-3 text-sm text-suave hover:border-marca hover:text-texto">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M16 3v4M8 3v4M3 11h18" />
          </svg>
          Quer ver isto no celular? Ligue o Google Agenda ›
        </Link>
      ) : null}
    </div>
  );
}

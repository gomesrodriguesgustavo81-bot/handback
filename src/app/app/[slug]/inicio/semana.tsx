"use client";

import Link from "next/link";
import { useState } from "react";

export type DiaDaSemana = { dia: string; sigla: string; numero: number; prazos: { id: string; href: string; ciclo: string; titulo: string; turma: string }[] };

/** "Esta semana": tocar num dia mostra os prazos dele (o azul vai para o dia escolhido). */
export function SemanaInterativa({ dias }: { dias: DiaDaSemana[] }) {
  const [escolhido, setEscolhido] = useState(0);
  const dia = dias[escolhido];
  return (
    <>
      <div role="group" aria-label="Dias da semana" className="grid grid-cols-7 gap-1 text-center">
        {dias.map((d, i) => {
          const ativo = i === escolhido;
          return (
            <button
              key={d.dia}
              type="button"
              aria-pressed={ativo}
              aria-label={`${d.sigla} ${d.numero}${i === 0 ? ", hoje" : ""}${d.prazos.length ? `, ${d.prazos.length} ${d.prazos.length === 1 ? "prazo" : "prazos"}` : ""}`}
              onClick={() => setEscolhido(i)}
              className={`toque flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] ${
                ativo ? "bg-marca text-sobre-marca" : i === 0 ? "text-marca ring-1 ring-marca/40" : "text-suave hover:bg-fundo"
              }`}
            >
              {d.sigla}
              <b className={`text-[14px] ${ativo ? "" : "text-texto"}`}>{d.numero}</b>
              <span aria-hidden className={`size-1.5 rounded-full ${d.prazos.length ? (ativo ? "bg-sobre-marca" : "bg-marca") : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>
      <div aria-live="polite" className="flex flex-col gap-1 text-[13px]">
        <span className="font-semibold text-suave">
          {escolhido === 0 ? "Hoje" : `${dia.sigla} ${dia.numero}`}
        </span>
        {dia.prazos.length ? (
          <ul className="flex flex-col gap-1">
            {dia.prazos.map((p) => (
              <li key={p.id}>
                <Link href={p.href} className="text-suave hover:underline">
                  prazo {p.ciclo} · <span className="font-semibold text-texto">{p.titulo}</span>
                  {p.turma ? ` · ${p.turma}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-suave">Nenhum prazo neste dia.</p>
        )}
      </div>
    </>
  );
}

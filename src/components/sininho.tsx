"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { marcarLido } from "@/app/avisos/acoes";

export type AvisoTela = { id: number; tipo: string; titulo: string; texto: string; link: string; criado_em: string; lido: boolean };

const COR: Record<string, { fundo: string; letra: string }> = {
  entrega: { fundo: "bg-marca-clara text-marca-forte", letra: "E" },
  ia: { fundo: "bg-info-fundo text-info", letra: "IA" },
  prazo: { fundo: "bg-reg-fundo text-reg", letra: "!" },
  atraso: { fundo: "bg-ruim-fundo text-ruim", letra: "!" },
  enviada: { fundo: "bg-ok-fundo text-ok", letra: "✓" },
  sistema: { fundo: "bg-neutro-fundo text-neutro", letra: "i" },
};

function dia(iso: string, hoje: string) {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
  if (d === hoje) return "Hoje";
  const ontem = new Date(`${hoje}T12:00:00Z`);
  ontem.setUTCDate(ontem.getUTCDate() - 1);
  if (d === ontem.toISOString().slice(0, 10)) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "numeric", month: "long" }).format(new Date(iso));
}
const hora = (iso: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Sininho do topo: avisos da pessoa, com os novos em destaque. */
export function Sininho({ itens, novos, hoje }: { itens: AvisoTela[]; novos: number; hoje: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [lidos, setLidos] = useState<Set<number>>(new Set());
  const [todos, setTodos] = useState(false);
  const [, iniciar] = useTransition();

  // Atualiza os avisos de tempos em tempos enquanto a tela está aberta.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 120_000);
    return () => clearInterval(t);
  }, [router]);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  const eNovo = (a: AvisoTela) => !a.lido && !todos && !lidos.has(a.id);
  const quantos = todos ? 0 : Math.max(0, novos - itens.filter((a) => !a.lido && lidos.has(a.id)).length);
  const grupos: { titulo: string; itens: AvisoTela[] }[] = [];
  for (const a of itens) {
    const t = dia(a.criado_em, hoje);
    const g = grupos.at(-1);
    if (g?.titulo === t) g.itens.push(a);
    else grupos.push({ titulo: t, itens: [a] });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={quantos ? `Avisos, ${quantos} ${quantos === 1 ? "novo" : "novos"}` : "Avisos"}
        aria-expanded={aberto}
        onClick={() => {
          setAberto((x) => !x);
          if (!aberto) router.refresh();
        }}
        className={`relative flex size-11 items-center justify-center rounded-full transition-colors ${aberto ? "bg-marca-clara" : "hover:bg-fundo"}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {quantos ? (
          <span aria-hidden className="absolute top-1 right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-erro px-1 text-[11px] font-bold text-white">
            {quantos > 99 ? "99+" : quantos}
          </span>
        ) : null}
      </button>
      {aberto ? (
        <>
          <button type="button" aria-label="Fechar os avisos" className="fixed inset-0 z-30 cursor-default" onClick={() => setAberto(false)} />
          <section
            aria-label="Avisos"
            className="entra fixed inset-x-2.5 top-16 z-40 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-borda bg-cartao shadow-xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96"
          >
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <h2 className="titulo text-xl font-extrabold">Avisos</h2>
              {quantos ? (
                <button
                  type="button"
                  onClick={() => {
                    setTodos(true);
                    iniciar(async () => {
                      await marcarLido("todos");
                      router.refresh();
                    });
                  }}
                  className="min-h-10 rounded-lg px-2.5 text-[13px] font-semibold text-marca-forte hover:bg-fundo"
                >
                  Marcar todos como lidos
                </button>
              ) : null}
            </div>
            <div className="flex flex-col overflow-y-auto pb-1">
              {!itens.length ? <p className="px-4 pb-4 text-sm text-suave">Nenhum aviso por enquanto. Quando chegar entrega ou análise, aparece aqui.</p> : null}
              {grupos.map((g) => (
                <div key={g.titulo} className="flex flex-col">
                  <span className="px-4 pt-2.5 pb-1 text-xs font-semibold text-suave">{g.titulo}</span>
                  {g.itens.map((a) => {
                    const c = COR[a.tipo] ?? COR.sistema;
                    const novo = eNovo(a);
                    const conteudo = (
                      <>
                        <span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${c.fundo}`}>{c.letra}</span>
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-sm leading-snug font-semibold">{a.titulo}</span>
                          {a.texto ? <span className="text-sm leading-snug text-texto">{a.texto}</span> : null}
                          <span className="text-xs text-suave">{hora(a.criado_em)}</span>
                        </span>
                        {novo ? <span aria-label="Novo" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-marca" /> : null}
                      </>
                    );
                    const classe = `flex items-start gap-3 px-4 py-2.5 text-left ${novo ? "bg-marca-clara/50" : ""} hover:bg-fundo`;
                    const ler = () => {
                      if (!novo) return;
                      setLidos((s) => new Set(s).add(a.id));
                      iniciar(() => marcarLido(a.id));
                    };
                    return a.link ? (
                      <Link
                        key={a.id}
                        href={a.link}
                        onClick={() => {
                          ler();
                          setAberto(false);
                        }}
                        className={classe}
                      >
                        {conteudo}
                      </Link>
                    ) : (
                      <button key={a.id} type="button" onClick={ler} className={classe}>
                        {conteudo}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <Link href="/conta/avisos" onClick={() => setAberto(false)} className="flex min-h-12 items-center justify-center border-t border-borda text-sm font-semibold text-marca-forte hover:bg-fundo">
              Como quero receber os avisos
            </Link>
          </section>
        </>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, ViewTransition, type ReactNode } from "react";

export type Icone = "inicio" | "entregas" | "aulas" | "calendario" | "equipes" | "relatorios" | "moodle" | "config" | "conta" | "avisos" | "drive" | "classroom" | "ajustes" | "contas";
/** tambem: outros caminhos que acendem este item (ex.: as páginas de dentro dele). */
export type ItemNav = { href: string; nome: string; icone: Icone; tambem?: string[] };

const TRACOS: Record<Icone | "mais", ReactNode> = {
  inicio: (
    <>
      <path d="M4 11l8-7 8 7v9H4z" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  ajustes: <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4" />,
  contas: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  entregas: <path d="M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6H4z" />,
  aulas: <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11M9 8h6" />,
  calendario: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  equipes: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.5M18 14.5c1.8.8 3 2.8 3 5.5" />
    </>
  ),
  relatorios: <path d="M5 20V10M12 20V4M19 20v-7" />,
  moodle: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  config: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
    </>
  ),
  conta: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  avisos: <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" />,
  mais: <path d="M4 7h16M4 12h16M4 17h16" />,
  drive: <path d="M8 3h8l6 11-4 7H6l-4-7zM8 3l6 11H2M16 3l-6 11M22 14H10l-4 7" />,
  classroom: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <circle cx="12" cy="9.5" r="2" />
      <path d="M8.5 14.5c.8-1.4 2-2 3.5-2s2.7.6 3.5 2M8 21h8M12 17v4" />
    </>
  ),
};

function Desenho({ icone }: { icone: Icone | "mais" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {TRACOS[icone]}
    </svg>
  );
}

/** Um grupo do menu (no computador vira um título que abre e fecha; no celular, um título na gaveta "Mais"). */
export type GrupoNav = { nome: string; itens: ItemNav[] };
/** Link "← Voltar" das páginas de dentro de um lugar (ex.: Ajustes da turma › Google Drive). */
export type Volta = { href: string; nome: string; prefixos: string[] };

/**
 * Navegação. No celular: barra fixa embaixo (Início e o dia a dia da turma)
 * e "Mais" (o resto, em grupos). No computador: menu na lateral, em grupos
 * que abrem e fecham.
 */
export function Navegacao({ abas, grupos }: { abas: ItemNav[]; grupos: GrupoNav[] }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const dentro = (href: string) => caminho === href || caminho.startsWith(href + "/");
  const extras = grupos.flatMap((g) => g.itens).filter((x) => !abas.some((a) => a.href === x.href));
  const todas = [...abas, ...extras];
  // A aba mais específica ganha (Relatórios fica acesa, não Entregas; Google Drive acende Ajustes da turma).
  const alcance = (x: ItemNav) => Math.max(-1, ...[x.href, ...(x.tambem ?? [])].filter(dentro).map((h) => h.length));
  const melhor = todas.map((x) => [x, alcance(x)] as const).filter(([, n]) => n >= 0).sort((a, b) => b[1] - a[1])[0]?.[0];
  const ativa = (item: ItemNav) => melhor?.href === item.href;
  const maisAtivo = extras.some(ativa);

  // Esc fecha a gaveta; trocar de página também.
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);
  const [visto, setVisto] = useState(caminho);
  if (visto !== caminho) {
    setVisto(caminho);
    setAberto(false);
  }

  // Menu do lado recolhido e grupos fechados (lembrados neste navegador).
  const [recolhido, setRecolhido] = useState(false);
  const [fechados, setFechados] = useState<string[]>([]);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecolhido(localStorage.getItem("hb-menu-recolhido") === "1");
      setFechados(JSON.parse(localStorage.getItem("hb-menu-grupos") ?? "[]"));
    } catch {}
  }, []);
  const alternarMenu = () =>
    setRecolhido((x) => {
      try {
        localStorage.setItem("hb-menu-recolhido", x ? "0" : "1");
      } catch {}
      return !x;
    });
  const alternarGrupo = (nome: string) =>
    setFechados((x) => {
      const novo = x.includes(nome) ? x.filter((n) => n !== nome) : [...x, nome];
      try {
        localStorage.setItem("hb-menu-grupos", JSON.stringify(novo));
      } catch {}
      return novo;
    });

  const mostrarBarra = abas.length + (extras.length ? 1 : 0) > 1;
  const linkLado = (a: ItemNav) => (
    <Link
      key={a.href}
      href={a.href}
      aria-current={ativa(a) ? "page" : undefined}
      title={recolhido ? a.nome : undefined}
      className={`toque flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors ${
        ativa(a) ? "bg-marca-clara font-semibold text-marca-forte" : "font-medium text-suave hover:bg-cartao hover:text-texto"
      }`}
    >
      <span className="shrink-0">
        <Desenho icone={a.icone} />
      </span>
      <span className={recolhido ? "sr-only" : "truncate"}>{a.nome}</span>
    </Link>
  );

  return (
    <>
      {/* Computador: menu na lateral, em grupos (dá para recolher e deixar só os ícones). */}
      <nav
        aria-label="Seções da empresa"
        className={`hidden flex-col gap-1 self-start transition-[width] duration-200 lg:sticky lg:top-6 lg:flex print:hidden ${recolhido ? "lg:w-12" : "lg:w-56"}`}
      >
        <button
          type="button"
          onClick={alternarMenu}
          aria-expanded={!recolhido}
          aria-label={recolhido ? "Abrir o menu" : "Recolher o menu"}
          title={recolhido ? "Abrir o menu" : "Recolher o menu"}
          className="toque mb-1 flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-suave hover:bg-cartao hover:text-texto"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d={recolhido ? "M9 4v16M13 10l2 2-2 2" : "M9 4v16M16 10l-2 2 2 2"} />
          </svg>
          {recolhido ? null : <span>Recolher</span>}
        </button>
        {grupos.map((g) => {
          const fechado = fechados.includes(g.nome) && !g.itens.some(ativa);
          return (
            <div key={g.nome} className="flex flex-col gap-1">
              {g.nome && !recolhido ? (
                <button
                  type="button"
                  onClick={() => alternarGrupo(g.nome)}
                  aria-expanded={!fechado}
                  className="toque mt-2 flex min-h-9 items-center justify-between rounded-lg px-3 text-[11px] font-semibold uppercase tracking-wide text-suave hover:text-texto"
                >
                  {g.nome}
                  <span aria-hidden className={`transition-transform duration-200 ${fechado ? "-rotate-90" : ""}`}>
                    ▾
                  </span>
                </button>
              ) : g.nome ? (
                <span aria-hidden className="mx-3 my-1 border-t border-borda" />
              ) : null}
              {fechado ? null : g.itens.map(linkLado)}
            </div>
          );
        })}
      </nav>

      {/* Celular: barra fixa embaixo, perto do dedo. */}
      {mostrarBarra ? (
        <nav
          aria-label="Seções da empresa"
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 rounded-[22px] bg-barra shadow-lg lg:hidden print:hidden"
          style={{ viewTransitionName: "barra-de-baixo" }}
        >
          <ul className="mx-auto flex max-w-xl">
            {abas.map((a) => (
              <li key={a.href} className="flex-1">
                <Link
                  href={a.href}
                  aria-current={ativa(a) ? "page" : undefined}
                  className={`toque flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs ${ativa(a) ? "font-bold text-white" : "font-medium text-barra-texto"}`}
                >
                  <span className="relative flex h-7 w-14 items-center justify-center">
                    {ativa(a) ? (
                      <ViewTransition name="pilula-da-barra" share="pilula" default="none">
                        <span aria-hidden className="absolute inset-0 rounded-full bg-white/15" />
                      </ViewTransition>
                    ) : null}
                    <span className="relative">
                      <Desenho icone={a.icone} />
                    </span>
                  </span>
                  {a.nome}
                </Link>
              </li>
            ))}
            {extras.length ? (
              <li className="flex-1">
                <button
                  type="button"
                  aria-expanded={aberto}
                  aria-haspopup="dialog"
                  onClick={() => setAberto(true)}
                  className={`toque flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-xs ${maisAtivo ? "font-bold text-white" : "font-medium text-barra-texto"}`}
                >
                  <span className="relative flex h-7 w-14 items-center justify-center">
                    {maisAtivo ? (
                      <ViewTransition name="pilula-da-barra" share="pilula" default="none">
                        <span aria-hidden className="absolute inset-0 rounded-full bg-white/15" />
                      </ViewTransition>
                    ) : null}
                    <span className="relative">
                      <Desenho icone="mais" />
                    </span>
                  </span>
                  Mais
                </button>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}

      {aberto ? (
        <div className="escurece fixed inset-0 z-40 flex items-end bg-texto/45 lg:hidden" onClick={() => setAberto(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mais opções"
            onClick={(e) => e.stopPropagation()}
            className="sobe flex max-h-[85vh] w-full flex-col gap-1 overflow-y-auto rounded-t-3xl bg-cartao px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <span aria-hidden className="mb-2 h-1 w-10 self-center rounded-full bg-borda" />
            {grupos.map((g) => {
              const itens = g.itens.filter((x) => extras.includes(x));
              if (!itens.length) return null;
              return (
                <div key={g.nome} className="flex flex-col gap-1">
                  {g.nome ? <span className="mt-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-suave">{g.nome}</span> : null}
                  {itens.map((a) => (
                    <Link
                      key={a.href}
                      href={a.href}
                      aria-current={ativa(a) ? "page" : undefined}
                      className={`toque flex min-h-13 items-center gap-3 rounded-xl px-3 text-base ${ativa(a) ? "bg-marca-clara font-semibold" : "hover:bg-fundo"}`}
                    >
                      <Desenho icone={a.icone} />
                      <span className="flex-1">{a.nome}</span>
                      <span aria-hidden className="text-suave">
                        ›
                      </span>
                    </Link>
                  ))}
                </div>
              );
            })}
            <button type="button" onClick={() => setAberto(false)} className="toque mt-3 min-h-12 rounded-xl border border-borda font-semibold">
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Nas páginas de dentro de um lugar, o caminho de volta (← Configurações, ← Ajustes da turma, ← Nova turma). */
export function Voltar({ voltas }: { voltas: Volta[] }) {
  const caminho = usePathname();
  const dentro = (href: string) => caminho === href || caminho.startsWith(href + "/");
  const v = voltas
    .map((x) => [x, Math.max(-1, ...x.prefixos.filter(dentro).map((p) => p.length))] as const)
    .filter(([x, n]) => n >= 0 && caminho !== x.href)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!v) return null;
  return (
    <Link href={v.href} transitionTypes={["nav-back"]} className="self-start text-sm font-medium text-marca-forte hover:underline print:hidden">
      ← {v.nome}
    </Link>
  );
}

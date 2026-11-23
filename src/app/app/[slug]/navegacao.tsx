"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export type Icone = "entregas" | "aulas" | "calendario" | "equipes" | "relatorios" | "moodle" | "config" | "conta" | "avisos" | "drive";
export type ItemNav = { href: string; nome: string; icone: Icone };

const TRACOS: Record<Icone | "mais", ReactNode> = {
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
};

function Desenho({ icone }: { icone: Icone | "mais" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {TRACOS[icone]}
    </svg>
  );
}

/**
 * Navegação da turma. No celular: barra fixa embaixo (as seções do dia a dia
 * e "Mais"). No computador: menu na lateral, com tudo à vista.
 */
export function Navegacao({
  abas,
  mais,
  configuracoes,
  paginasDeConfiguracao,
}: {
  abas: ItemNav[];
  mais: ItemNav[];
  configuracoes: string | null;
  paginasDeConfiguracao: string[];
}) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const dentro = (href: string) => caminho === href || caminho.startsWith(href + "/");
  const emConfiguracao = Boolean(configuracoes && (dentro(configuracoes) || paginasDeConfiguracao.some(dentro)));
  const extras: ItemNav[] = [...mais, ...(configuracoes ? [{ href: configuracoes, nome: "Configurações", icone: "config" as const }] : [])];
  // A aba mais específica ganha (Relatórios fica acesa, não Entregas).
  const todas = [...abas, ...extras];
  const melhor = todas.filter((x) => dentro(x.href)).sort((a, b) => b.href.length - a.href.length)[0];
  const ativa = (item: ItemNav) => (melhor ? melhor.href === item.href : item.icone === "config" && emConfiguracao);
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

  // Menu do lado recolhido (lembrado neste navegador).
  const [recolhido, setRecolhido] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecolhido(localStorage.getItem("hb-menu-recolhido") === "1");
    } catch {}
  }, []);
  const alternarMenu = () =>
    setRecolhido((x) => {
      try {
        localStorage.setItem("hb-menu-recolhido", x ? "0" : "1");
      } catch {}
      return !x;
    });

  const mostrarBarra = abas.length + (extras.length ? 1 : 0) > 1;

  return (
    <>
      {/* Computador: menu na lateral (dá para recolher e deixar só os ícones). */}
      <nav
        aria-label="Seções da empresa"
        className={`hidden flex-col gap-1 self-start transition-[width] duration-200 lg:sticky lg:top-6 lg:flex print:hidden ${recolhido ? "lg:w-12" : "lg:w-52"}`}
      >
        <button
          type="button"
          onClick={alternarMenu}
          aria-expanded={!recolhido}
          aria-label={recolhido ? "Abrir o menu" : "Recolher o menu"}
          title={recolhido ? "Abrir o menu" : "Recolher o menu"}
          className="mb-1 flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium text-suave hover:bg-cartao hover:text-texto"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d={recolhido ? "M9 4v16M13 10l2 2-2 2" : "M9 4v16M16 10l-2 2 2 2"} />
          </svg>
          {recolhido ? null : <span>Recolher</span>}
        </button>
        {todas.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            aria-current={ativa(a) ? "page" : undefined}
            title={recolhido ? a.nome : undefined}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors ${
              ativa(a) ? "bg-acento/40 font-semibold text-texto dark:bg-marca-clara" : "font-medium text-suave hover:bg-cartao hover:text-texto"
            }`}
          >
            <span className="shrink-0">
              <Desenho icone={a.icone} />
            </span>
            <span className={recolhido ? "sr-only" : "truncate"}>{a.nome}</span>
          </Link>
        ))}
      </nav>

      {/* Celular: barra fixa embaixo, perto do dedo. */}
      {mostrarBarra ? (
        <nav
          aria-label="Seções da empresa"
          className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-cartao/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
        >
          <ul className="mx-auto flex max-w-xl">
            {abas.map((a) => (
              <li key={a.href} className="flex-1">
                <Link
                  href={a.href}
                  aria-current={ativa(a) ? "page" : undefined}
                  className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs ${ativa(a) ? "font-bold text-texto" : "font-medium text-suave"}`}
                >
                  <span className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${ativa(a) ? "bg-acento text-sobre-acento" : ""}`}>
                    <Desenho icone={a.icone} />
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
                  className={`flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-xs ${maisAtivo ? "font-bold text-texto" : "font-medium text-suave"}`}
                >
                  <span className={`flex h-7 w-14 items-center justify-center rounded-full ${maisAtivo ? "bg-acento text-sobre-acento" : ""}`}>
                    <Desenho icone="mais" />
                  </span>
                  Mais
                </button>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}

      {aberto ? (
        <div className="fixed inset-0 z-40 flex items-end bg-texto/45 lg:hidden" onClick={() => setAberto(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mais opções"
            onClick={(e) => e.stopPropagation()}
            className="sobe flex max-h-[85vh] w-full flex-col gap-1 overflow-y-auto rounded-t-3xl bg-cartao px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <span aria-hidden className="mb-2 h-1 w-10 self-center rounded-full bg-borda" />
            {extras.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                aria-current={ativa(a) ? "page" : undefined}
                className={`flex min-h-13 items-center gap-3 rounded-xl px-3 text-base ${ativa(a) ? "bg-marca-clara font-semibold" : "hover:bg-fundo"}`}
              >
                <Desenho icone={a.icone} />
                <span className="flex-1">{a.nome}</span>
                <span aria-hidden className="text-suave">
                  ›
                </span>
              </Link>
            ))}
            <button type="button" onClick={() => setAberto(false)} className="mt-2 min-h-12 rounded-xl border border-borda font-semibold">
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Nas páginas de configuração, o caminho de volta para a lista. */
export function VoltarConfiguracoes({ configuracoes, paginasDeConfiguracao }: { configuracoes: string; paginasDeConfiguracao: string[] }) {
  const caminho = usePathname();
  const dentro = (href: string) => caminho === href || caminho.startsWith(href + "/");
  const sub = caminho !== configuracoes && (dentro(configuracoes) || paginasDeConfiguracao.some(dentro));
  if (!sub) return null;
  return (
    <Link href={configuracoes} className="self-start text-sm font-medium text-marca-forte hover:underline print:hidden">
      ← Configurações
    </Link>
  );
}

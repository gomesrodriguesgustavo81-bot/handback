"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Abas do dia a dia da turma e a engrenagem das Configurações. Nas páginas
 * de configuração, aparece o caminho de volta para a lista.
 */
export function AbasEmpresa({
  abas,
  configuracoes,
  paginasDeConfiguracao,
}: {
  abas: { href: string; nome: string }[];
  configuracoes: string | null;
  paginasDeConfiguracao: string[];
}) {
  const caminho = usePathname();
  const dentro = (href: string) => caminho === href || caminho.startsWith(href + "/");
  const emConfiguracao = Boolean(configuracoes && (dentro(configuracoes) || paginasDeConfiguracao.some(dentro)));
  const subpagina = emConfiguracao && configuracoes && !dentro(configuracoes);
  return (
    <div className="flex flex-col gap-3 print:hidden">
      <nav aria-label="Seções da empresa" className="flex items-end justify-between gap-2 border-b border-borda">
        <ul className="-mb-px flex min-w-0 gap-1 overflow-x-auto">
          {abas.map((a) => {
            const ativa = !emConfiguracao && dentro(a.href);
            return (
              <li key={a.href}>
                <Link
                  href={a.href}
                  aria-current={ativa ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-[15px] font-medium ${
                    ativa ? "border-marca text-marca-forte" : "border-transparent text-suave hover:text-texto"
                  }`}
                >
                  {a.nome}
                </Link>
              </li>
            );
          })}
        </ul>
        {configuracoes ? (
          <Link
            href={configuracoes}
            aria-label="Configurações"
            title="Configurações"
            aria-current={emConfiguracao ? "page" : undefined}
            className={`-mb-px inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border-b-2 ${
              emConfiguracao ? "border-marca text-marca-forte" : "border-transparent text-suave hover:text-texto"
            }`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </Link>
        ) : null}
      </nav>
      {subpagina && configuracoes ? (
        <Link href={configuracoes} className="self-start text-sm font-medium text-marca-forte hover:underline">
          ← Configurações
        </Link>
      ) : null}
    </div>
  );
}

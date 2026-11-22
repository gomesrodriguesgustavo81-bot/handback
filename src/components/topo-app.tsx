"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Marca } from "./marca";

type Empresa = { slug: string; nome: string; papel: string; palavra: string };

function iniciais(email: string) {
  const partes = email.split("@")[0].split(/[._-]+/).filter(Boolean);
  const letras = partes.length > 1 ? partes[0][0] + partes[1][0] : (partes[0] ?? "?").slice(0, 2);
  return letras.toUpperCase();
}

/**
 * Barra do topo das áreas logadas: logo, nome da empresa aberta e o menu
 * da conta (círculo com as iniciais). "Trocar de empresa" só aparece para
 * quem tem mais de uma.
 */
export function TopoApp({ email, dono, empresas }: { email: string; dono: boolean; empresas: Empresa[] }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const slug = caminho.match(/^\/app\/([^/]+)/)?.[1];
  const empresa = empresas.find((e) => e.slug === slug);
  const item = "flex min-h-12 w-full items-center rounded-lg px-3 text-left text-[15px] hover:bg-fundo";

  return (
    <header className="border-b border-borda bg-cartao print:hidden">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Marca href="/app" />
          {empresa ? (
            <>
              <span aria-hidden className="text-borda">
                /
              </span>
              <Link href={`/app/${empresa.slug}`} className="truncate font-semibold hover:text-marca-forte">
                {empresa.nome}
              </Link>
            </>
          ) : null}
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label="Sua conta"
            aria-expanded={aberto}
            aria-haspopup="menu"
            onClick={() => setAberto((x) => !x)}
            className="flex size-10 items-center justify-center rounded-full bg-acento text-sm font-bold text-sobre-acento transition-transform active:scale-95"
          >
            {iniciais(email)}
          </button>
          {aberto ? (
            <>
              <button type="button" aria-label="Fechar o menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setAberto(false)} />
              <div role="menu" aria-label="Sua conta" className="entra absolute right-0 z-40 mt-2 flex w-72 flex-col gap-0.5 rounded-2xl border border-borda bg-cartao p-2 shadow-lg">
                <div className="flex flex-col px-3 pt-1 pb-2">
                  <span className="truncate text-sm font-medium">{email}</span>
                  {empresa ? <span className="truncate text-xs text-suave">Seu papel: {empresa.papel} · {empresa.nome}</span> : null}
                </div>
                <Link role="menuitem" href="/conta" onClick={() => setAberto(false)} className={item}>
                  Minha conta
                </Link>
                {empresas.length > 1 ? (
                  <Link role="menuitem" href="/app?todas=1" onClick={() => setAberto(false)} className={item}>
                    Trocar de {(empresa?.palavra ?? "espaço").toLowerCase()}
                  </Link>
                ) : null}
                {dono ? (
                  <Link role="menuitem" href="/admin" onClick={() => setAberto(false)} className={item}>
                    Administração do Handback
                  </Link>
                ) : null}
                <form action="/sair" method="post">
                  <button role="menuitem" type="submit" className={`${item} text-erro`}>
                    Sair
                  </button>
                </form>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

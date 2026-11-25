"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Marca } from "./marca";
import { Sininho, type AvisoTela } from "./sininho";


type Empresa = { slug: string; nome: string; papel: string; palavra: string; avalia?: boolean };

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
export function TopoApp({
  email,
  nome = "",
  dono,
  empresas,
  avisos,
}: {
  email: string;
  nome?: string;
  dono: boolean;
  empresas: Empresa[];
  avisos?: { itens: AvisoTela[]; novos: number; hoje: string };
}) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  // Esc fecha o menu.
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);
  const abrirMenu = () => setAberto((x) => !x);
  const slug = caminho.match(/^\/app\/([^/]+)/)?.[1];
  const empresa = empresas.find((e) => e.slug === slug);
  const item = "flex min-h-12 w-full items-center rounded-lg px-3 text-left text-[15px] hover:bg-fundo";

  return (
    <header className="relative z-50 border-b border-borda bg-cartao print:hidden" style={{ viewTransitionName: "topo-do-app" }}>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
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
        <div className="flex items-center gap-1">
        {avisos ? <Sininho {...avisos} /> : null}
        <div className="relative">
          <button
            type="button"
            aria-label="Sua conta"
            aria-expanded={aberto}
            aria-haspopup="menu"
            onClick={abrirMenu}
            className="flex size-10 items-center justify-center rounded-full bg-acento text-sm font-bold text-sobre-acento transition-transform active:scale-95"
          >
            {iniciais(nome ? nome.replace(/^(prof\.?|profa\.?)\s+/i, "").replace(/\s+/g, ".") : email)}
          </button>
          {aberto ? (
            <>
              <button type="button" aria-label="Fechar o menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setAberto(false)} />
              <div role="menu" aria-label="Sua conta" className="entra absolute right-0 z-40 mt-2 flex w-72 flex-col gap-0.5 rounded-2xl border border-borda bg-cartao p-2 shadow-lg">
                <div className="flex flex-col px-3 pt-1 pb-2">
                  {nome ? <span className="truncate font-semibold">{nome}</span> : null}
                  <span className={`truncate ${nome ? "text-xs text-suave" : "text-sm font-medium"}`}>{email}</span>
                  {empresa ? <span className="truncate text-xs text-suave">Seu papel: {empresa.papel} · {empresa.nome}</span> : null}
                </div>
                <Link role="menuitem" href="/conta" onClick={() => setAberto(false)} className={item}>
                  Minha conta
                </Link>
                <Link role="menuitem" href="/conta/avisos" onClick={() => setAberto(false)} className={item}>
                  Meus avisos
                </Link>
                {empresa?.avalia ? (
                  <Link role="menuitem" href={`/app/${empresa.slug}/contas`} onClick={() => setAberto(false)} className={item}>
                    Contas conectadas
                  </Link>
                ) : null}
                <Link role="menuitem" href="/conta#aparencia" onClick={() => setAberto(false)} className={item}>
                  Aparência (claro ou escuro)
                </Link>
                <div className="mx-1 mb-1 border-t border-borda" />
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
      </div>
    </header>
  );
}

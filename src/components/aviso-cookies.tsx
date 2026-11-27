"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { COOKIE_AVISO } from "@/lib/termos";

/** Aviso de cookies: só informa (usamos apenas os necessários) e lembra que a pessoa já viu. */
export function AvisoCookies() {
  // No servidor conta como "já visto" (não desenha nada); no navegador lê o cookie.
  const visto = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE_AVISO}=`));
      } catch {
        return true;
      }
    },
    () => true,
  );
  const [fechou, setFechou] = useState(false);
  if (visto || fechou) return null;

  function entendi() {
    try {
      const seguro = location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${COOKIE_AVISO}=1; Max-Age=31536000; Path=/; SameSite=Lax${seguro}`;
    } catch {
      // Tudo bem: o aviso só some até a página recarregar.
    }
    setFechou(true);
  }

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="entra fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-lg flex-col gap-2.5 rounded-[20px] border border-borda bg-cartao p-4 shadow-[0_14px_40px_rgb(15_26_51/0.22)]"
    >
      <b className="text-base">Cookies: só os necessários</b>
      <p className="text-[13px] leading-relaxed text-suave">
        Usamos cookies só para o site funcionar: manter você conectado, lembrar a turma que você escolheu e o tema claro ou escuro.{" "}
        <b className="text-texto">Não usamos cookies de anúncio nem de rastreamento.</b>
      </p>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={entendi}
          className="toque min-h-12 rounded-xl bg-marca px-4 text-[15px] font-bold text-sobre-marca hover:bg-marca-forte"
        >
          Entendi
        </button>
        <Link href="/cookies" className="flex min-h-11 items-center justify-center text-sm font-semibold text-marca-forte hover:underline">
          Ver quais cookies usamos
        </Link>
      </div>
    </div>
  );
}

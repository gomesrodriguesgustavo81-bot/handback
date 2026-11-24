"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** No Início: convida a ligar os avisos no celular, se ainda não ligou (some ao fechar). */
export function ConviteAvisos() {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    try {
      const pode = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMostrar(pode && Notification.permission === "default" && localStorage.getItem("hb-convite-avisos") !== "fechado");
    } catch {}
  }, []);
  if (!mostrar) return null;
  return (
    <div className="entra flex items-center gap-3 rounded-2xl border border-borda bg-cartao px-4 py-3">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-marca-clara text-marca">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" />
        </svg>
      </span>
      <Link href="/conta/avisos" className="flex min-w-0 flex-1 flex-col">
        <b className="text-sm">Avisos no celular</b>
        <span className="text-xs text-suave">Saiba na hora quando chega entrega e quando a IA termina.</span>
      </Link>
      <button
        type="button"
        aria-label="Fechar o convite dos avisos"
        onClick={() => {
          try {
            localStorage.setItem("hb-convite-avisos", "fechado");
          } catch {}
          setMostrar(false);
        }}
        className="toque flex size-10 shrink-0 items-center justify-center rounded-xl text-suave hover:bg-fundo"
      >
        ✕
      </button>
    </div>
  );
}

"use client";

import { useEffect } from "react";

export function Fechar({ aviso }: { aviso: string }) {
  useEffect(() => {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ handbackGmail: aviso }, window.location.origin);
      window.close();
    } else {
      window.location.replace(`/app?gmail=${encodeURIComponent(aviso)}`);
    }
  }, [aviso]);
  return (
    <main className="flex flex-1 items-center justify-center p-6 text-center">
      <p className="text-suave">{aviso === "conectado" ? "Gmail conectado. Pode fechar esta janela." : "Pode fechar esta janela."}</p>
    </main>
  );
}

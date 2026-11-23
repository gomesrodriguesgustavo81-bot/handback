"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const CHAVE = "hb-lembrete-duas-etapas";

/**
 * Nos 14 primeiros dias a pessoa entra só com a senha. Este lembrete mostra
 * até quando, com o botão para ativar agora. "Depois" esconde até fechar o navegador.
 */
export function LembreteDuasEtapas({ prazo }: { prazo: string }) {
  const [escondido, setEscondido] = useState(true);
  const [dias, setDias] = useState<number | null>(null);
  useEffect(() => {
    let visto = false;
    try {
      visto = sessionStorage.getItem(CHAVE) === prazo;
    } catch {}
    const falta = Math.max(0, Math.ceil((new Date(prazo).getTime() - Date.now()) / 86_400_000));
    // Lido no navegador (data e armazenamento da sessão só existem aqui).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDias(falta);
    setEscondido(visto && falta > 3);
  }, [prazo]);
  if (escondido || dias === null) return null;
  const data = new Date(prazo).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "numeric", timeZone: "America/Sao_Paulo" }).replace(".", "");
  const urgente = dias <= 3;
  return (
    <section
      role="status"
      aria-label="Proteja sua conta"
      className={`flex flex-col gap-2 rounded-2xl px-4 py-3 text-sm ${urgente ? "bg-alerta-fundo text-alerta" : "bg-marca-clara text-marca-forte"}`}
    >
      <strong className="text-[15px]">
        {urgente ? `Faltam ${dias} ${dias === 1 ? "dia" : "dias"} para ativar a proteção da conta` : "Proteja sua conta quando quiser"}
      </strong>
      <span>
        {urgente
          ? `Depois de ${data[0].toUpperCase()}${data.slice(1)} o Handback vai pedir o código do app autenticador do celular. Leva 2 minutos.`
          : `Nos primeiros 14 dias você entra só com a senha, para conhecer o Handback com calma. A partir de ${data} vamos pedir também o código do app autenticador do celular.`}
      </span>
      <span className="flex flex-wrap gap-2">
        <Link href="/conta/duas-etapas" className="inline-flex min-h-11 items-center rounded-xl bg-marca px-4 font-semibold text-sobre-marca">
          Ativar agora
        </Link>
        <button
          type="button"
          onClick={() => {
            try {
              sessionStorage.setItem(CHAVE, prazo);
            } catch {}
            setEscondido(true);
          }}
          className="inline-flex min-h-11 items-center rounded-xl border border-current px-4 font-semibold"
        >
          Depois
        </button>
      </span>
    </section>
  );
}

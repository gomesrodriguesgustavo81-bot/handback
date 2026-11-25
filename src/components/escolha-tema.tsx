"use client";

import { useEffect, useState } from "react";
import { aplicarTema, temaAtual, type Tema } from "@/lib/tema";

const TEMAS: { valor: Tema; nome: string; dica: string }[] = [
  { valor: "claro", nome: "Claro", dica: "Fundo branco" },
  { valor: "escuro", nome: "Escuro", dica: "Fundo escuro, bom à noite" },
  { valor: "sistema", nome: "Igual ao aparelho", dica: "Segue o celular ou computador" },
];

/** Aparência (claro, escuro ou igual ao aparelho). Fica em Minha conta. */
export function EscolhaTema() {
  const [tema, setTema] = useState<Tema>("sistema");
  useEffect(() => {
    // O tema só existe no navegador (cookie), por isso depois de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTema(temaAtual());
  }, []);
  return (
    <div role="radiogroup" aria-label="Aparência" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {TEMAS.map((t) => (
        <button
          key={t.valor}
          type="button"
          role="radio"
          aria-checked={tema === t.valor}
          onClick={() => {
            aplicarTema(t.valor);
            setTema(t.valor);
          }}
          className={`toque flex min-h-14 flex-col items-start justify-center rounded-xl border px-3 text-left ${
            tema === t.valor ? "border-marca bg-marca-clara text-marca-forte" : "border-borda bg-cartao hover:bg-fundo"
          }`}
        >
          <b className="text-[15px]">{t.nome}</b>
          <span className="text-xs text-suave">{t.dica}</span>
        </button>
      ))}
    </div>
  );
}

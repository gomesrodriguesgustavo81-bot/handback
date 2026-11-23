"use client";

import { useEffect, useState } from "react";

/** Primeiro nome, ou o começo do e-mail quando a pessoa ainda não escreveu o nome. */
export function primeiroNome(nome: string, email: string): string {
  const n = nome.trim().replace(/^(prof\.?|profa\.?|professora?|dr\.?|dra\.?)\s+/i, "");
  if (n) return n.split(/\s+/)[0];
  const parte = email.split("@")[0].split(/[._-]+/)[0] ?? "";
  return parte ? parte[0].toUpperCase() + parte.slice(1) : "";
}

/** "Bom dia", "Boa tarde" ou "Boa noite", pelo relógio de quem está vendo. */
export function Saudacao({ nome, email }: { nome: string; email: string }) {
  const [periodo, setPeriodo] = useState<string | null>(null);
  useEffect(() => {
    const h = new Date().getHours();
    // O horário só existe no aparelho de quem vê (por isso depois de montar).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPeriodo(h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite");
  }, []);
  const quem = primeiroNome(nome, email);
  return (
    <p className="min-h-7 text-lg font-bold tracking-tight print:hidden" aria-live="off">
      {periodo ? `${periodo}${quem ? `, ${quem}` : ""}!` : " "}
    </p>
  );
}

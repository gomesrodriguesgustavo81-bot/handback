"use client";

import { useActionState } from "react";
import { pedirNovaSenha, type EstadoEntrar } from "../actions";
import { Aviso, Botao, Campo } from "@/components/ui";

export function FormEsqueci() {
  const [estado, acao, enviando] = useActionState<EstadoEntrar, FormData>(pedirNovaSenha, null);
  if (estado?.ok) return <Aviso>{estado.mensagem}</Aviso>;
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo rotulo="Seu e-mail" name="email" type="email" inputMode="email" autoComplete="username" required />
      {estado ? <Aviso tipo="erro">{estado.mensagem}</Aviso> : null}
      <Botao type="submit" disabled={enviando}>
        {enviando ? "Enviando…" : "Mandar link para nova senha"}
      </Botao>
    </form>
  );
}

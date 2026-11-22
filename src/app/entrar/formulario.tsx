"use client";

import { useActionState } from "react";
import { enviarLink, type EstadoEntrar } from "./actions";
import { Aviso, Botao, Campo } from "@/components/ui";

export function FormularioEntrar({ voltar }: { voltar: string }) {
  const [estado, acao, enviando] = useActionState<EstadoEntrar, FormData>(enviarLink, null);

  if (estado?.ok) {
    return <Aviso>{estado.mensagem}</Aviso>;
  }

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="voltar" value={voltar} />
      <Campo
        rotulo="Seu e-mail"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder="voce@empresa.com.br"
        dica="Você recebe um link para entrar. Não precisa de senha."
      />
      {estado && !estado.ok ? <Aviso tipo="erro">{estado.mensagem}</Aviso> : null}
      <Botao type="submit" disabled={enviando}>
        {enviando ? "Enviando…" : "Receber link de acesso"}
      </Botao>
    </form>
  );
}

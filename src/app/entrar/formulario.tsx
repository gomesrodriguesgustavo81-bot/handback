"use client";

import Link from "next/link";
import { useActionState } from "react";
import { entrarComSenha, type EstadoEntrar } from "./actions";
import { Aviso, Botao, Campo } from "@/components/ui";

export function FormularioEntrar({ voltar }: { voltar: string }) {
  const [estado, acao, enviando] = useActionState<EstadoEntrar, FormData>(entrarComSenha, null);
  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="voltar" value={voltar} />
      <Campo rotulo="E-mail" name="email" type="email" inputMode="email" autoComplete="username" required placeholder="voce@empresa.com.br" />
      <div className="flex flex-col gap-1.5">
        <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" required />
        <Link href="/entrar/esqueci" className="self-end text-sm font-medium text-marca-forte hover:underline">
          Esqueci minha senha
        </Link>
      </div>
      {estado && !estado.ok ? <Aviso tipo="erro">{estado.mensagem}</Aviso> : null}
      <Botao type="submit" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  );
}

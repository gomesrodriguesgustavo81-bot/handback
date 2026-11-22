"use client";

import { useActionState } from "react";
import { criarEmpresa, type EstadoForm } from "./actions";
import { Aviso, Botao, Campo } from "@/components/ui";
import { FRENTES } from "@/lib/frentes";

export function NovaEmpresa() {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(criarEmpresa, null);

  return (
    <form action={acao} className="flex flex-col gap-4" key={estado?.ok ? estado.mensagem : "form"}>
      <Campo rotulo="Nome da empresa" name="nome" required placeholder="Ex.: Escola Alfa" />
      <Campo
        rotulo="Endereço no Handback"
        name="slug"
        placeholder="escola-alfa"
        dica="Opcional. Se ficar vazio, é criado a partir do nome."
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Tipo de empresa</span>
        <select
          name="frente"
          required
          defaultValue=""
          className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
        >
          <option value="" disabled>
            Escolha…
          </option>
          {Object.entries(FRENTES).map(([valor, f]) => (
            <option key={valor} value={valor}>
              {f.nome}
            </option>
          ))}
        </select>
        <span className="text-xs text-suave">Define as palavras usadas (aula, ciclo, competência…). Dá para mudar depois.</span>
      </label>
      <Campo
        rotulo="E-mail do administrador da empresa"
        name="email"
        type="email"
        inputMode="email"
        placeholder="responsavel@empresa.com.br"
        dica="Opcional. A pessoa vira administradora ao entrar com este e-mail."
      />
      {estado ? <Aviso tipo={estado.ok ? "info" : "erro"}>{estado.mensagem}</Aviso> : null}
      <Botao type="submit" disabled={enviando}>
        {enviando ? "Criando…" : "Criar empresa"}
      </Botao>
    </form>
  );
}

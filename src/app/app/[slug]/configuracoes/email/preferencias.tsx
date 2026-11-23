"use client";

import { useActionState } from "react";
import { salvarPreferenciasDeEnvio, type Estado } from "@/app/conta/acoes";
import { Aviso, Botao, Campo } from "@/components/ui";

/** Nome que aparece para os alunos e cópia de cada devolutiva para a própria pessoa. */
export function PreferenciasDeEnvio({ nome, copia, email }: { nome: string; copia: boolean; email: string }) {
  const [estado, acao, salvando] = useActionState<Estado, FormData>(salvarPreferenciasDeEnvio, null);
  return (
    <form action={acao} aria-label="Como você aparece nos e-mails" className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
      <h2 className="font-semibold">Como você aparece nos e-mails</h2>
      {!nome ? (
        <Aviso tipo="alerta">Você ainda não escolheu seu nome. Até lá, os alunos veem o nome da sua conta Google.</Aviso>
      ) : null}
      <Campo
        rotulo="Seu nome"
        name="nome"
        autoComplete="name"
        required
        minLength={2}
        maxLength={80}
        defaultValue={nome}
        placeholder="Ex.: Prof. Ana Souza"
        dica="Aparece como remetente das devolutivas e dos lembretes."
      />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="copia" value="sim" defaultChecked={copia} className="mt-0.5 size-5 shrink-0 accent-[var(--marca)]" />
        <span>
          <span className="font-medium">Receber uma cópia de cada devolutiva</span>
          <span className="block text-suave">Chega em {email}, como registro do que foi enviado. Os alunos não veem essa cópia.</span>
        </span>
      </label>
      {estado ? <Aviso tipo={estado.ok ? "info" : "erro"}>{estado.mensagem}</Aviso> : null}
      <Botao type="submit" disabled={salvando} className="self-start">
        {salvando ? "Salvando…" : "Salvar"}
      </Botao>
    </form>
  );
}

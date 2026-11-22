"use client";

import { useActionState, useState, useTransition } from "react";
import { comecarDuasEtapas, conferirCodigo, confirmarDuasEtapas, definirSenha, type Estado } from "./acoes";
import { Aviso, Botao, Campo } from "@/components/ui";

export function FormSenha() {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(definirSenha, null);
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Campo
        rotulo="Nova senha"
        name="senha"
        type="password"
        autoComplete="new-password"
        required
        dica="Pelo menos 12 caracteres, com letras e números. Dica: uma frase com números, como “Cafe com leite 2026”."
      />
      <Campo rotulo="Repita a senha" name="repetir" type="password" autoComplete="new-password" required />
      {estado && !estado.ok ? <Aviso tipo="erro">{estado.mensagem}</Aviso> : null}
      <Botao type="submit" disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar senha"}
      </Botao>
    </form>
  );
}

function CampoCodigo() {
  return (
    <Campo
      rotulo="Código de 6 números"
      name="codigo"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]{6,7}"
      maxLength={7}
      required
      autoFocus
    />
  );
}

export function FormCodigo({ voltar }: { voltar: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(conferirCodigo, null);
  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="voltar" value={voltar} />
      <CampoCodigo />
      {estado && !estado.ok ? <Aviso tipo="erro">{estado.mensagem}</Aviso> : null}
      <Botao type="submit" disabled={enviando}>
        {enviando ? "Conferindo…" : "Confirmar"}
      </Botao>
    </form>
  );
}

function Confirmar({ factorId }: { factorId: string }) {
  const [estado, acao, enviando] = useActionState<Estado, FormData>(confirmarDuasEtapas.bind(null, factorId), null);
  return (
    <form action={acao} className="flex flex-col gap-4">
      <CampoCodigo />
      {estado && !estado.ok ? <Aviso tipo="erro">{estado.mensagem}</Aviso> : null}
      <Botao type="submit" disabled={enviando}>
        {enviando ? "Conferindo…" : "Ativar"}
      </Botao>
    </form>
  );
}

export function CadastroDuasEtapas({ textoBotao = "Começar" }: { textoBotao?: string }) {
  const [dados, setDados] = useState<{ id: string; qr: string; chave: string } | null>(null);
  const [erro, setErro] = useState("");
  const [pendente, iniciar] = useTransition();
  if (!dados) {
    return (
      <div className="flex flex-col gap-3">
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
        <Botao
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await comecarDuasEtapas();
              if (r.ok) setDados(r);
              else setErro(r.mensagem);
            })
          }
        >
          {pendente ? "Preparando…" : textoBotao}
        </Botao>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
        <li>
          No celular, abra um app autenticador (<strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong> ou
          parecido) e toque em <strong>+</strong> para adicionar uma conta.
        </li>
        <li>
          Leia este QR code com o app:
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dados.qr} alt="QR code para o app autenticador" width={180} height={180} className="mt-2 rounded-lg bg-white p-2" />
        </li>
        <li>
          Não consegue ler? Digite esta chave no app:
          <code aria-label="Chave para digitar no app" className="mt-1 block break-all rounded-lg bg-fundo px-3 py-2 text-sm">
            {dados.chave}
          </code>
        </li>
        <li>Digite abaixo o código de 6 números que o app mostrar.</li>
      </ol>
      <Confirmar factorId={dados.id} />
    </div>
  );
}

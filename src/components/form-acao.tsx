"use client";

import { startTransition, useActionState, useState, useTransition, type ReactNode } from "react";
import { Aviso, Botao } from "./ui";

export type Resultado = { ok: boolean; mensagem: string; vez?: number } | null;
type Estado = (NonNullable<Resultado> & { versao?: number }) | null;

/**
 * Formulário que chama uma ação do servidor e mostra o resultado
 * (sucesso em verde, erro em vermelho) logo acima do botão.
 * Depois de um sucesso, os campos voltam ao estado inicial (se `limparAoSalvar`).
 * Em caso de erro, o que a pessoa digitou continua nos campos.
 */
export function FormAcao({
  acao,
  textoBotao,
  textoEnviando = "Salvando…",
  limparAoSalvar = false,
  children,
}: {
  acao: (anterior: Resultado, dados: FormData) => Promise<Resultado>;
  textoBotao: string;
  textoEnviando?: string;
  limparAoSalvar?: boolean;
  children: ReactNode;
}) {
  // Guarda quantas vezes já salvou com sucesso: o formulário só se limpa quando
  // esse número muda (um erro depois de um sucesso não apaga o que foi digitado).
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(async (anterior, dados) => {
    const r = await acao(anterior, dados);
    const versao = anterior?.versao ?? 0;
    return r ? { ...r, versao: r.ok && limparAoSalvar ? versao + 1 : versao } : r;
  }, null);
  const chave = `form-${estado?.versao ?? 0}`;
  return (
    <form
      key={chave}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        // Envio manual: evita que o React limpe os campos quando dá erro.
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        startTransition(() => enviar(dados));
      }}
    >
      {children}
      {estado ? <Aviso tipo={estado.ok ? "info" : "erro"}>{estado.mensagem}</Aviso> : null}
      <Botao type="submit" disabled={enviando}>
        {enviando ? textoEnviando : textoBotao}
      </Botao>
    </form>
  );
}

/**
 * Botão que pede confirmação antes de enviar (para apagar, remover,
 * desligar…). A pergunta aparece na própria tela, com "Sim" e "Não": a
 * caixinha do navegador (window.confirm) não aparece em alguns aplicativos.
 */
export function BotaoConfirmar({
  acao,
  pergunta,
  children,
}: {
  acao: () => Promise<void>;
  pergunta: string;
  children: ReactNode;
}) {
  const [perguntando, setPerguntando] = useState(false);
  const [pendente, iniciar] = useTransition();
  if (!perguntando) {
    return (
      <button
        type="button"
        onClick={() => setPerguntando(true)}
        className="inline-flex min-h-11 items-center rounded-xl border border-erro/40 px-3 text-sm text-erro hover:bg-erro-fundo"
      >
        {children}
      </button>
    );
  }
  return (
    <div role="alertdialog" aria-label={pergunta} className="flex w-full flex-col gap-2 rounded-xl border border-erro/40 bg-erro-fundo p-3 text-sm sm:max-w-md">
      <p className="text-texto">{pergunta}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pendente}
          onClick={() => iniciar(async () => {
            await acao();
            setPerguntando(false);
          })}
          className="inline-flex min-h-11 items-center rounded-xl bg-erro px-3 font-medium text-white disabled:opacity-60"
        >
          {pendente ? "Um momento…" : "Sim, confirmar"}
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() => setPerguntando(false)}
          className="inline-flex min-h-11 items-center rounded-xl border border-borda bg-cartao px-3 font-medium text-texto"
        >
          Não
        </button>
      </div>
    </div>
  );
}

"use client";

import { startTransition, useActionState, type ReactNode } from "react";
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

/** Botão que pede confirmação antes de enviar (para apagar, remover…). */
export function BotaoConfirmar({
  acao,
  pergunta,
  children,
}: {
  acao: () => Promise<void>;
  pergunta: string;
  children: ReactNode;
}) {
  return (
    <form
      action={acao}
      onSubmit={(e) => {
        if (!window.confirm(pergunta)) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-xl border border-erro/40 px-3 text-sm text-erro hover:bg-erro-fundo"
      >
        {children}
      </button>
    </form>
  );
}

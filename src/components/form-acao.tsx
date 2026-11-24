"use client";

import { startTransition, useActionState, useTransition, type ReactNode } from "react";
import { Aviso, Botao } from "./ui";
import { useConfirmar, type Pergunta } from "./confirmar";

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
  confirmar,
  aoSalvar,
  children,
}: {
  acao: (anterior: Resultado, dados: FormData) => Promise<Resultado>;
  /** Chamado depois de salvar com sucesso (ex.: fechar a gaveta). */
  aoSalvar?: (mensagem: string) => void;
  textoBotao: string;
  textoEnviando?: string;
  limparAoSalvar?: boolean;
  /** Pergunta antes de enviar (adicionar, convidar, criar…). Pode usar o que foi digitado. */
  confirmar?: Pergunta | ((dados: FormData) => Pergunta);
  children: ReactNode;
}) {
  const { pedir, janela } = useConfirmar();
  // Guarda quantas vezes já salvou com sucesso: o formulário só se limpa quando
  // esse número muda (um erro depois de um sucesso não apaga o que foi digitado).
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(async (anterior, dados) => {
    const r = await acao(anterior, dados);
    if (r?.ok && aoSalvar) aoSalvar(r.mensagem);
    const versao = anterior?.versao ?? 0;
    return r ? { ...r, versao: r.ok && limparAoSalvar ? versao + 1 : versao } : r;
  }, null);
  const chave = `form-${estado?.versao ?? 0}`;
  return (
    <form
      key={chave}
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        // Envio manual: evita que o React limpe os campos quando dá erro.
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        if (confirmar && !(await pedir(typeof confirmar === "function" ? confirmar(dados) : confirmar))) return;
        startTransition(() => enviar(dados));
      }}
    >
      {children}
      {janela}
      {estado ? <Aviso tipo={estado.ok ? "info" : "erro"}>{estado.mensagem}</Aviso> : null}
      <Botao type="submit" disabled={enviando}>
        {enviando ? (
          <>
            <span aria-hidden className="rodinha" />
            {textoEnviando}
          </>
        ) : (
          textoBotao
        )}
      </Botao>
    </form>
  );
}

/**
 * Botão que pede confirmação antes de agir (apagar, remover, desligar…),
 * numa janela no meio da tela com "Sim, confirmar" e "Não".
 */
export function BotaoConfirmar({
  acao,
  pergunta,
  texto,
  sim,
  perigo = true,
  children,
}: {
  acao: () => Promise<void>;
  pergunta: string;
  texto?: string;
  sim?: string;
  perigo?: boolean;
  children: ReactNode;
}) {
  const { pedir, janela } = useConfirmar();
  const [pendente, iniciar] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={pendente}
        onClick={async () => {
          // "Apagar X? Isso não pode ser desfeito." → pergunta em destaque, explicação embaixo.
          const m = pergunta.match(/^([^?]*\?)\s+([\s\S]+)$/);
          const titulo = m ? m[1] : pergunta;
          const extra = [m?.[2], texto].filter(Boolean).join(" ") || undefined;
          if (await pedir({ titulo, texto: extra, sim, perigo })) iniciar(() => acao());
        }}
        className={`toque inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm disabled:opacity-60 ${
          perigo ? "border-erro/40 text-erro hover:bg-erro-fundo" : "border-borda text-marca-forte hover:bg-fundo"
        }`}
      >
        {pendente ? (
          <>
            <span aria-hidden className="rodinha" />
            Um momento…
          </>
        ) : (
          children
        )}
      </button>
      {janela}
    </>
  );
}

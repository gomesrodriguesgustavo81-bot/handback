"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type Pergunta = {
  /** A pergunta, em uma frase: "Apagar a Equipe Azul?" */
  titulo: string;
  /** O que acontece, em palavras simples (opcional). */
  texto?: string;
  /** Texto do botão de confirmar. Padrão: "Sim, confirmar". */
  sim?: string;
  /** Apagar, desconectar…: botão vermelho. */
  perigo?: boolean;
};

/**
 * Janela de confirmação do Handback. Toda ação de adicionar, apagar,
 * conectar, desconectar ou enviar passa por ela antes de acontecer.
 * (A caixinha do navegador, window.confirm, não aparece em alguns aplicativos.)
 */
export function useConfirmar() {
  const [aberta, setAberta] = useState<(Pergunta & { responder: (ok: boolean) => void }) | null>(null);
  const pedir = (p: Pergunta) => new Promise<boolean>((responder) => setAberta({ ...p, responder }));
  const fechar = (ok: boolean) => {
    aberta?.responder(ok);
    setAberta(null);
  };
  const janela = aberta ? <JanelaConfirmar p={aberta} fechar={fechar} /> : null;
  return { pedir, janela };
}

function JanelaConfirmar({ p, fechar }: { p: Pergunta; fechar: (ok: boolean) => void }) {
  const nao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    nao.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar(false);
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);
  // Vai direto no <body>: assim cobre a tela toda, mesmo dentro de um cartão animado.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-4 sm:items-center" onClick={() => fechar(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmar-titulo"
        aria-describedby={p.texto ? "confirmar-texto" : undefined}
        onClick={(e) => e.stopPropagation()}
        className="entra flex w-full max-w-sm flex-col gap-3 rounded-2xl bg-cartao p-5 text-left text-texto shadow-xl"
      >
        <h2 id="confirmar-titulo" className="text-lg font-bold">
          {p.titulo}
        </h2>
        {p.texto ? (
          <p id="confirmar-texto" className="text-sm text-suave">
            {p.texto}
          </p>
        ) : null}
        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={nao}
            type="button"
            onClick={() => fechar(false)}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-borda bg-cartao px-4 font-medium text-texto hover:bg-fundo"
          >
            Não
          </button>
          <button
            type="button"
            onClick={() => fechar(true)}
            className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-semibold ${
              p.perigo ? "bg-erro text-white hover:opacity-90" : "bg-marca text-sobre-marca hover:bg-marca-forte"
            }`}
          >
            {p.sim ?? "Sim, confirmar"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Para formulários com action: o envio só segue depois do "Sim".
 * Uso: const { onSubmit, janela } = useFormConfirmado(pergunta); <form onSubmit={onSubmit}>…{janela}</form>
 */
export function useFormConfirmado(pergunta: Pergunta | ((dados: FormData) => Pergunta)) {
  const { pedir, janela } = useConfirmar();
  const confirmado = useRef(false);
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    if (confirmado.current) {
      confirmado.current = false;
      return;
    }
    e.preventDefault();
    const form = e.currentTarget;
    const botao = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const p = typeof pergunta === "function" ? pergunta(new FormData(form, botao)) : pergunta;
    if (await pedir(p)) {
      confirmado.current = true;
      form.requestSubmit(botao ?? undefined);
    }
  };
  return { onSubmit, janela };
}

/** Formulário comum (ação do servidor) que só envia depois de confirmar. */
export function FormConfirmado({ pergunta, action, className, children }: { pergunta: Pergunta; action: (dados: FormData) => void | Promise<void>; className?: string; children: ReactNode }) {
  const { onSubmit, janela } = useFormConfirmado(pergunta);
  return (
    <form action={action} className={className} onSubmit={onSubmit}>
      {children}
      {janela}
    </form>
  );
}

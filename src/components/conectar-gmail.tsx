"use client";
import { useConfirmar } from "./confirmar";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AvisoGmail } from "./aviso-gmail";

/**
 * Botão "Conectar com Google": abre só uma janelinha do Google. Quando a
 * pessoa aceita, a janelinha fecha sozinha e esta tela se atualiza.
 * Se o navegador bloquear janelas, cai na troca de página normal.
 */
const PERGUNTA = {
  gmail: { titulo: "Conectar seu Gmail?", texto: "O Handback vai poder enviar e-mails do seu endereço (as devolutivas que você aprovar). Ele não lê sua caixa." },
  agenda: { titulo: "Conectar seu Google Agenda?", texto: "O Handback só vai mexer nas agendas que ele mesmo criar. Ele não vê seus outros compromissos." },
  drive: { titulo: "Conectar seu Google Drive?", texto: "O Handback só vai mexer nas pastas e arquivos que ele mesmo criar. Ele não vê o resto do seu Drive." },
  classroom: {
    titulo: "Conectar seu Google Classroom?",
    texto: "O Handback vai ver suas turmas, alunos e tarefas, criar tarefas e lançar notas. Do seu Drive, só os arquivos que você escolher. Marque todas as opções na janela do Google.",
  },
} as const;

export function ConectarGmail({
  voltar,
  texto = "Conectar com Google",
  destaque = true,
  servico = "gmail",
}: {
  voltar: string;
  texto?: string;
  destaque?: boolean;
  servico?: keyof typeof PERGUNTA;
}) {
  const router = useRouter();
  const [esperando, setEsperando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const janela = useRef<Window | null>(null);
  const { pedir, janela: confirmacao } = useConfirmar();

  useEffect(() => {
    function receber(e: MessageEvent) {
      if (e.origin !== window.location.origin || typeof e.data?.handbackGmail !== "string") return;
      setEsperando(false);
      setAviso(e.data.handbackGmail);
      router.refresh();
    }
    window.addEventListener("message", receber);
    return () => window.removeEventListener("message", receber);
  }, [router]);

  useEffect(() => {
    if (!esperando) return;
    const t = setInterval(() => {
      if (!janela.current || janela.current.closed) setEsperando(false);
    }, 600);
    return () => clearInterval(t);
  }, [esperando]);

  const extra = servico === "gmail" ? "" : `&servico=${servico}`;
  const paginaInteira = `/api/gmail/conectar?voltar=${encodeURIComponent(voltar)}${extra}`;
  return (
    <>
      {aviso && aviso !== "conectado" ? <AvisoGmail aviso={aviso} servico={servico} /> : null}
      <a
        href={paginaInteira}
        onClick={async (e) => {
          e.preventDefault();
          if (!(await pedir({ ...PERGUNTA[servico], sim: "Sim, conectar" }))) return;
          const largura = 480;
          const altura = 640;
          const w = window.open(
            `/api/gmail/conectar?voltar=%2Fgmail-pronto${extra}`,
            "handback-gmail",
            `popup=yes,width=${largura},height=${altura},left=${Math.max(0, (screen.width - largura) / 2)},top=${Math.max(0, (screen.height - altura) / 2)}`,
          );
          if (!w) {
            // Janela bloqueada pelo navegador: abre na própria página.
            window.open(paginaInteira, "_self");
            return;
          }
          janela.current = w;
          setAviso(null);
          setEsperando(true);
        }}
        className={
          destaque
            ? "inline-flex min-h-12 shrink-0 items-center justify-center gap-2.5 rounded-xl bg-marca px-4 font-semibold text-sobre-marca hover:bg-marca-forte"
            : "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-marca px-4 font-medium text-sobre-marca hover:bg-marca-forte"
        }
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="rounded-full bg-white p-px">
          <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-4z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.4 35.2 44 30 44 24c0-1.3-.1-2.7-.4-4z" />
        </svg>
        {texto}
      </a>
      {confirmacao}
      {esperando ? (
        <div role="dialog" aria-modal="true" aria-label="Aguardando o Google" className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
          <div className="entra flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl bg-cartao p-6 text-center">
            <span aria-hidden className="size-7 animate-spin rounded-full border-[3px] border-borda border-t-marca" />
            <p className="font-semibold">Aguardando o Google…</p>
            <p className="text-sm text-suave">Escolha sua conta na janelinha e toque em Permitir. Ela fecha sozinha.</p>
            <button type="button" onClick={() => janela.current?.focus()} className="min-h-11 rounded-xl px-4 text-sm font-medium text-marca-forte hover:bg-fundo">
              Não achei a janelinha
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

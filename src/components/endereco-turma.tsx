"use client";

import { useState } from "react";

function Copiar({ texto, rotulo, principal = false }: { texto: string; rotulo: string; principal?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 2500);
        } catch {
          setOk(false);
        }
      }}
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-medium transition-colors ${
        principal ? "bg-marca text-sobre-marca hover:bg-marca-forte" : "border border-borda bg-cartao text-texto hover:bg-fundo"
      }`}
    >
      {ok ? "Copiado ✓" : rotulo}
    </button>
  );
}

/**
 * Endereço para onde quem entrega manda os trabalhos, com botão de copiar e
 * uma mensagem pronta para o professor (ou gestor) repassar.
 */
export function EnderecoDaTurma({
  endereco,
  etiqueta,
  exemploAssunto,
  comTitulo = true,
}: {
  endereco: string;
  etiqueta: string;
  exemploAssunto: string;
  comTitulo?: boolean;
}) {
  const mensagem = [
    "Olá! A partir de agora, mandem as entregas por e-mail para:",
    endereco,
    "",
    `No assunto, comecem com ${etiqueta}, o número da etapa e o nome do grupo. Exemplo:`,
    exemploAssunto,
    "",
    "Anexem os arquivos ou colem os links (no Google Docs/Slides, compartilhem como “qualquer pessoa com o link”).",
    "Usem o e-mail que vocês me passaram no cadastro. Se quiserem, coloquem o meu e-mail em cópia.",
  ].join("\n");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {comTitulo ? <span className="text-sm font-medium">Endereço para receber as entregas</span> : null}
        <code className="break-all rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm">{endereco}</code>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Copiar texto={endereco} rotulo="Copiar endereço" principal />
        <Copiar texto={mensagem} rotulo="Copiar mensagem para a turma" />
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-marca-forte">Ver a mensagem pronta</summary>
        <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-fundo p-3 font-sans text-sm leading-relaxed">{mensagem}</pre>
      </details>
    </div>
  );
}

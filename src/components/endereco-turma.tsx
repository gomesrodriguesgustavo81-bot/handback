"use client";

import { useState } from "react";
import { generoDe } from "@/lib/nomes";

export type AulaDaMensagem = { id: string; rotulo: string; numero: number; prazo: string | null; itens: string[] };
export type DadosDaMensagem = {
  etiqueta: string;
  palavraEtapa: string;
  quem: string;
  assinatura: string;
  aulas: AulaDaMensagem[];
  daVez: string | null;
};

function Copiar({ texto, rotulo, principal = false, aoCopiar }: { texto: string; rotulo: string; principal?: boolean; aoCopiar?: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          aoCopiar?.();
          setTimeout(() => setOk(false), 2500);
        } catch {
          setOk(false);
        }
      }}
      className={`inline-flex min-h-12 items-center justify-center rounded-xl px-4 font-semibold transition-colors ${
        principal ? "bg-marca text-sobre-marca hover:bg-marca-forte" : "border border-borda bg-cartao text-texto hover:bg-fundo"
      }`}
    >
      {ok ? (principal ? "Mensagem copiada ✓" : "Copiado ✓") : rotulo}
    </button>
  );
}

/** A mensagem que o professor cola no WhatsApp, no Moodle ou no e-mail da turma. */
export function montarMensagemDaTurma(endereco: string, d: DadosDaMensagem, aulaId: string | null): string {
  const aula = d.aulas.find((a) => a.id === aulaId);
  const f = generoDe(d.palavraEtapa) === "f";
  const linhas = ["Olá, turma!", ""];
  if (aula) {
    const de = f ? "da" : "do";
    linhas.push(aula.prazo ? `A entrega ${de} ${aula.rotulo} vence ${aula.prazo}.` : `Entrega ${de} ${aula.rotulo}.`);
    if (aula.itens.length) linhas.push("", "O que entregar:", ...aula.itens.map((i) => `• ${i}`));
    linhas.push("", "Mandem por e-mail para:", endereco, "", "Assunto (copiem igual):", `${d.etiqueta} ${d.palavraEtapa} ${aula.numero}`);
  } else {
    linhas.push(
      "As entregas são feitas por e-mail, para:",
      endereco,
      "",
      `No assunto, escrevam ${d.etiqueta} e o número d${f ? "a" : "o"} ${d.palavraEtapa.toLowerCase()}. Por exemplo, para ${f ? "a" : "o"} ${d.palavraEtapa.toLowerCase()} 1:`,
      `${d.etiqueta} ${d.palavraEtapa} 1`,
    );
  }
  linhas.push("", "Anexem os arquivos ou colem os links (no Google Docs, Slides ou Drive, compartilhem como “qualquer pessoa com o link”). Mandem do e-mail que está no cadastro (é por ele que o Handback sabe de quem é a entrega).");
  if (d.assinatura) linhas.push("", d.assinatura);
  return linhas.join("\n");
}

/**
 * Endereço de entrega da turma com a mensagem pronta: já vem com a aula da
 * vez, o prazo, o que entregar e o assunto certo. Copiar copia a mensagem inteira.
 */
export function EnderecoDaTurma({
  endereco,
  dados,
  comTitulo = true,
  aoCopiar,
}: {
  endereco: string;
  dados: DadosDaMensagem;
  comTitulo?: boolean;
  aoCopiar?: () => void;
}) {
  const [aula, setAula] = useState<string | null>(dados.daVez);
  const mensagem = montarMensagemDaTurma(endereco, dados, aula);
  const opcoes = [{ id: null as string | null, rotulo: "Geral (sem aula)" }, ...dados.aulas.map((a) => ({ id: a.id as string | null, rotulo: a.rotulo }))];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {comTitulo ? <span className="text-sm font-medium">Endereço para receber as entregas</span> : null}
        <code className="break-all rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm">{endereco}</code>
      </div>
      {dados.aulas.length ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Mensagem sobre qual {dados.palavraEtapa.toLowerCase()}?</span>
          <select
            value={aula ?? ""}
            onChange={(e) => setAula(e.target.value || null)}
            className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
          >
            {opcoes.map((o) => (
              <option key={o.id ?? "geral"} value={o.id ?? ""}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <pre aria-label="Mensagem para a turma" className="whitespace-pre-wrap break-words rounded-xl border border-borda bg-cartao p-3 font-sans text-sm leading-relaxed">
        {mensagem}
      </pre>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Copiar texto={mensagem} rotulo="Copiar mensagem" principal aoCopiar={aoCopiar} />
        <Copiar texto={endereco} rotulo="Copiar só o endereço" aoCopiar={aoCopiar} />
      </div>
      <p className="text-xs text-suave">Cole no WhatsApp, no Moodle ou no e-mail da turma.</p>
    </div>
  );
}

/** Botão da página de cada aula/ciclo: copia a mensagem pronta daquela aula. */
export function CopiarMensagemDaAula({ endereco, dados, aulaId, aoCopiar }: { endereco: string; dados: DadosDaMensagem; aulaId: string; aoCopiar?: () => void }) {
  const mensagem = montarMensagemDaTurma(endereco, dados, aulaId);
  return (
    <div className="flex flex-col gap-2">
      <Copiar texto={mensagem} rotulo="Copiar mensagem para a turma" principal aoCopiar={aoCopiar} />
      <details className="text-sm">
        <summary className="inline-flex min-h-10 cursor-pointer items-center font-medium text-marca-forte">Ver a mensagem</summary>
        <pre aria-label="Mensagem desta aula" className="mt-1 whitespace-pre-wrap break-words rounded-xl border border-borda bg-fundo p-3 font-sans text-sm leading-relaxed">
          {mensagem}
        </pre>
      </details>
    </div>
  );
}

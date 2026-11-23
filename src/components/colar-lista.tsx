"use client";
import { useConfirmar } from "./confirmar";

import { useActionState, useState, startTransition } from "react";
import { lerListaDePessoas } from "@/lib/nomes";
import type { Resultado } from "./form-acao";
import { Aviso, Botao } from "./ui";

/** Cadastro em lote: cola a lista (um por linha) e vê antes o que foi entendido. */
export function ColarLista({
  acao,
  umNome,
  variosNome,
}: {
  acao: (anterior: Resultado, dados: FormData) => Promise<Resultado>;
  umNome: string;
  variosNome: string;
}) {
  const [texto, setTexto] = useState("");
  const [estado, enviar, enviando] = useActionState<Resultado, FormData>(async (a, d) => {
    const r = await acao(a, d);
    if (r?.ok) setTexto(String(r.mensagem.match(/\n([\s\S]*)$/)?.[1] ?? ""));
    return r;
  }, null);
  const lidos = lerListaDePessoas(texto);
  const { pedir, janela } = useConfirmar();
  const bons = lidos.filter((l) => !l.erro);
  const minusculo = (bons.length === 1 ? umNome : variosNome).toLowerCase();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const n = lidos.filter((l) => !l.erro).length;
        if (!(await pedir({ titulo: `Cadastrar ${n} ${(n === 1 ? umNome : variosNome).toLowerCase()}?`, sim: "Sim, cadastrar" }))) return;
        const d = new FormData();
        d.set("lista", texto);
        startTransition(() => enviar(d));
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Cole da planilha ou da lista de chamada: um por linha, com nome e e-mail.</span>
        <textarea
          aria-label={`Lista de ${variosNome.toLowerCase()}`}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          placeholder={"Ana Souza; ana@exemplo.com\nBruno Lima <bruno@exemplo.com>"}
          className="w-full rounded-xl border border-borda bg-cartao px-3 py-2 font-mono text-sm leading-relaxed text-texto"
        />
      </label>
      {lidos.length ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-marca-forte">
            {bons.length} pronto(s) para cadastrar{lidos.length - bons.length ? ` · ${lidos.length - bons.length} com problema` : ""}
          </p>
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {lidos.map((l, i) => (
              <li key={i} className={`flex flex-col rounded-lg px-2.5 py-1.5 text-sm ${l.erro ? "bg-ruim-fundo text-ruim" : "bg-neutro-fundo"}`}>
                <span className="font-semibold">{l.nome}</span>
                <span className="break-all text-xs">{l.erro ? `${l.email ? `${l.email} — ` : ""}${l.erro}` : l.email}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {estado ? <Aviso tipo={estado.ok ? "info" : "erro"}>{estado.mensagem.split("\n")[0]}</Aviso> : null}
      <Botao type="submit" disabled={enviando || !bons.length}>
        {enviando ? "Cadastrando…" : bons.length ? `Cadastrar ${bons.length} ${minusculo}` : "Nada para cadastrar"}
      </Botao>
      {janela}
    </form>
  );
}

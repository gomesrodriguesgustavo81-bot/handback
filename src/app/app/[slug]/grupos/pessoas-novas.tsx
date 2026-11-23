"use client";

import { useState } from "react";

type Linha = { chave: number; nome: string; email: string };

/** Pessoas do cadastro novo: uma linha por pessoa (nome e e-mail), como na tela de editar. */
export function PessoasNovas() {
  const [linhas, setLinhas] = useState<Linha[]>([{ chave: 1, nome: "", email: "" }]);
  const [proxima, setProxima] = useState(2);
  const mudar = (chave: number, campo: "nome" | "email", valor: string) =>
    setLinhas((l) => l.map((x) => (x.chave === chave ? { ...x, [campo]: valor } : x)));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Pessoas</legend>
      <p className="-mt-1 text-xs text-suave">Todas recebem a devolutiva e qualquer uma pode mandar a entrega. Cada e-mail só pode estar em um cadastro.</p>
      <ul className="flex flex-col gap-2">
        {linhas.map((l, i) => (
          <li key={l.chave} className="flex flex-col gap-2 rounded-xl border border-borda p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-suave">Pessoa {i + 1}</span>
              {linhas.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Tirar a pessoa ${i + 1}`}
                  onClick={() => setLinhas((x) => x.filter((y) => y.chave !== l.chave))}
                  className="min-h-9 rounded-lg px-2 text-xs font-medium text-erro hover:bg-erro-fundo"
                >
                  Tirar
                </button>
              ) : null}
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-suave">Nome</span>
              <input
                name="pessoa_nome"
                aria-label={`Nome da pessoa ${i + 1}`}
                value={l.nome}
                maxLength={200}
                onChange={(e) => mudar(l.chave, "nome", e.target.value)}
                placeholder="Ex.: Ana Souza"
                className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto placeholder:text-suave"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-suave">E-mail</span>
              <input
                name="pessoa_email"
                aria-label={`E-mail da pessoa ${i + 1}`}
                inputMode="email"
                autoComplete="off"
                value={l.email}
                onChange={(e) => mudar(l.chave, "email", e.target.value)}
                placeholder="ana@email.com"
                className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto placeholder:text-suave"
              />
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          setLinhas((l) => [...l, { chave: proxima, nome: "", email: "" }]);
          setProxima((n) => n + 1);
        }}
        className="inline-flex min-h-11 items-center self-start rounded-xl border border-dashed border-borda px-3 text-sm font-semibold text-marca-forte hover:bg-fundo"
      >
        + Outra pessoa
      </button>
    </fieldset>
  );
}

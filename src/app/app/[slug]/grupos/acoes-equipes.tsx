"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ColarLista } from "@/components/colar-lista";
import { FormAcao } from "@/components/form-acao";
import { Aviso, Campo } from "@/components/ui";
import { generoDe } from "@/lib/nomes";
import { adicionarPessoa, cadastrarEmLote, criarGrupo } from "./acoes";
import { PessoasNovas } from "./pessoas-novas";

export type Cadastro = { id: string; nome: string; pessoas: { id: string; nome: string; email: string }[] };

/** Gaveta: sobe de baixo no celular, janela no meio no computador. */
function Gaveta({ titulo, fechar, children }: { titulo: string; fechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector('[role="alertdialog"]') && fechar();
    window.addEventListener("keydown", esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = antes;
    };
  }, [fechar]);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-texto/45 sm:items-center sm:p-6" onClick={fechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="sobe flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto rounded-t-3xl bg-cartao px-4 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl sm:p-6"
      >
        <span aria-hidden className="h-1 w-10 self-center rounded-full bg-borda sm:hidden" />
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button type="button" onClick={fechar} aria-label="Fechar" className="inline-flex size-11 items-center justify-center rounded-xl text-xl text-suave hover:bg-fundo">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Os dois botões do topo da lista: "Adicionar pessoa" (numa equipe, junto de
 * alguém, ou sozinha) e "Criar equipe" (com gente nova ou juntando quem está sozinho).
 */
export function AcoesEquipes({
  slug,
  cadastros,
  individual,
  umaEquipe,
  equipes,
}: {
  slug: string;
  cadastros: Cadastro[];
  individual: boolean;
  umaEquipe: string;
  equipes: string;
}) {
  const [aberta, setAberta] = useState<null | "pessoa" | "equipe" | "lista">(null);
  const [aviso, setAviso] = useState("");
  const [busca, setBusca] = useState("");
  const fechar = () => setAberta(null);
  const salvo = (m: string) => {
    setAviso(m.split("\n")[0]);
    setAberta(null);
  };
  const umaMin = umaEquipe.toLowerCase();
  const a = generoDe(umaEquipe) === "f" ? "a" : "o";
  const grupos = cadastros.filter((c) => c.pessoas.length > 1);
  const sozinhos = cadastros.filter((c) => c.pessoas.length === 1);
  const vazios = cadastros.filter((c) => c.pessoas.length === 0);
  const filtro = busca.trim().toLowerCase();
  const achados = sozinhos.filter((c) => !filtro || `${c.pessoas[0].nome} ${c.pessoas[0].email} ${c.nome}`.toLowerCase().includes(filtro));
  const botao = "inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl px-4 text-[15px] font-semibold transition-colors";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setAviso(""); setAberta("pessoa"); }} className={`${botao} bg-marca text-sobre-marca hover:bg-marca-forte`}>
          + Adicionar pessoa
        </button>
        {individual ? (
          <button type="button" onClick={() => { setAviso(""); setAberta("lista"); }} className={`${botao} border border-marca bg-cartao text-marca-forte hover:bg-fundo`}>
            Colar uma lista
          </button>
        ) : (
          <button type="button" onClick={() => { setAviso(""); setAberta("equipe"); }} className={`${botao} border border-marca bg-cartao text-marca-forte hover:bg-fundo`}>
            + Criar {umaMin}
          </button>
        )}
      </div>
      {aviso ? <Aviso tipo="info">{aviso}</Aviso> : null}

      {aberta === "pessoa" ? (
        <Gaveta titulo="Adicionar pessoa" fechar={fechar}>
          <FormAcao
            acao={adicionarPessoa.bind(null, slug)}
            textoBotao="Adicionar"
            aoSalvar={salvo}
            confirmar={(d) => {
              const destino = String(d.get("destino") ?? "sozinha");
              const nome = String(d.get("nome") ?? "").trim() || "esta pessoa";
              const email = String(d.get("email") ?? "").trim().toLowerCase();
              const g = cadastros.find((c) => c.id === destino);
              return g
                ? { titulo: `Adicionar ${nome} em “${g.nome}”?`, texto: `A devolutiva passa a ir também para ${email}.`, sim: "Sim, adicionar" }
                : { titulo: `Adicionar ${nome}?`, texto: `Entra sozinha, com entrega individual. A devolutiva vai para ${email}.`, sim: "Sim, adicionar" };
            }}
          >
            <Campo rotulo="Nome" name="nome" required maxLength={200} placeholder="Ex.: Ana Souza" />
            <Campo rotulo="E-mail" name="email" type="email" inputMode="email" autoComplete="off" required placeholder="ana@email.com" />
            {individual ? (
              <input type="hidden" name="destino" value="sozinha" />
            ) : (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Em qual {umaMin} ela entra?</span>
                <select name="destino" defaultValue="sozinha" className="min-h-12 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto">
                  <option value="sozinha">Sozinha (entrega individual)</option>
                  {grupos.length ? (
                    <optgroup label={equipes}>
                      {grupos.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nome} ({g.pessoas.length} pessoas)
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {sozinhos.length ? (
                    <optgroup label="Junto com quem está sozinho">
                      {sozinhos.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nome}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {vazios.length ? (
                    <optgroup label="Sem ninguém ainda">
                      {vazios.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nome}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </label>
            )}
          </FormAcao>
        </Gaveta>
      ) : null}

      {aberta === "equipe" ? (
        <Gaveta titulo={`Criar ${umaMin}`} fechar={fechar}>
          <FormAcao
            acao={criarGrupo.bind(null, slug)}
            textoBotao={`Criar ${umaMin}`}
            aoSalvar={salvo}
            confirmar={(d) => {
              const nome = String(d.get("nome") ?? "").trim();
              const juntos = d.getAll("membro").length;
              const novos = d.getAll("pessoa_email").filter((x) => String(x).trim()).length;
              const partes = [
                juntos ? `${juntos} ${juntos === 1 ? "pessoa sai" : "pessoas saem"} da entrega individual e ${juntos === 1 ? "passa" : "passam"} a entregar junto.` : "",
                novos ? `${novos} ${novos === 1 ? "pessoa nova entra" : "pessoas novas entram"}.` : "",
              ].filter(Boolean);
              return { titulo: `Criar “${nome}”?`, texto: partes.join(" ") || "Começa sem ninguém; depois é só adicionar pessoas.", sim: `Sim, criar` };
            }}
          >
            <Campo rotulo={`Nome d${a} ${umaMin}`} name="nome" required maxLength={120} placeholder={`Ex.: ${umaEquipe} Azul`} />
            <Campo rotulo="Tema ou projeto (opcional)" name="tema" maxLength={200} />
            {sozinhos.length ? (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-sm font-medium">Quem está sozinho e entra nest{a === "a" ? "a" : "e"} {umaMin}</legend>
                {sozinhos.length > 6 ? (
                  <input
                    type="search"
                    aria-label="Procurar pessoa"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Procurar pelo nome ou e-mail"
                    className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto placeholder:text-suave"
                  />
                ) : null}
                <ul className="flex max-h-72 flex-col divide-y divide-borda overflow-y-auto rounded-xl border border-borda">
                  {sozinhos.map((c) => {
                    const p = c.pessoas[0];
                    return (
                      <li key={c.id} className={achados.includes(c) ? "" : "hidden"}>
                        <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                          <input type="checkbox" name="membro" value={p.id} className="size-5 shrink-0 accent-[var(--marca)]" />
                          <span className="flex min-w-0 flex-col">
                            <span className="font-medium">{p.nome || c.nome}</span>
                            <span className="truncate text-xs text-suave">{p.email}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                {filtro && !achados.length ? <p className="text-sm text-suave">Ninguém sozinho com esse nome.</p> : null}
              </fieldset>
            ) : null}
            <details className="group" open={!sozinhos.length}>
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-marca-forte [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
                {sozinhos.length ? "Incluir também pessoas novas" : "Pessoas"}
              </summary>
              <div className="mt-2">
                <PessoasNovas />
              </div>
            </details>
          </FormAcao>
        </Gaveta>
      ) : null}

      {aberta === "lista" ? (
        <Gaveta titulo={`Adicionar ${equipes.toLowerCase()} de uma vez`} fechar={fechar}>
          <ColarLista acao={cadastrarEmLote.bind(null, slug)} umNome={umaEquipe} variosNome={equipes} />
        </Gaveta>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { SinalSalvo, useSalvar } from "@/components/campo-auto";
import { BotaoConfirmar } from "@/components/form-acao";
import { Selo } from "@/components/ui";
import { generoDe } from "@/lib/nomes";
import { apagarGrupo, renomearGrupo } from "./acoes";

export type Pessoa = { nome: string; email: string };

/** Acima disso não parece equipe (provavelmente a turma toda). */
const GRANDE = 12;

/** Um cadastro da lista: nome, quantas pessoas, prévia dos nomes e a lista com os e-mails. */
export function CartaoGrupo({
  slug,
  g,
  podeGerir,
  palavra,
  doMoodle,
}: {
  slug: string;
  g: { id: string; nome: string; tema: string | null; ativo: boolean; pessoas: Pessoa[] };
  podeGerir: boolean;
  palavra: string;
  doMoodle: boolean;
}) {
  const [renomeando, setRenomeando] = useState(false);
  const [nome, setNome] = useState(g.nome);
  const { salvar, estado, erro } = useSalvar(slug, `grupo-${g.id}`, g.nome, (v) => renomearGrupo(slug, g.id, v));
  const pessoas = [...g.pessoas].sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR"));
  const n = pessoas.length;
  const previa = pessoas.slice(0, 3).map((p) => p.nome || p.email.split("@")[0]);

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
      {renomeando ? (
        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between gap-2 text-xs text-suave">
            Novo nome
            <SinalSalvo estado={estado} erro={erro} />
          </span>
          <input
            autoFocus
            defaultValue={nome}
            maxLength={120}
            onChange={(e) => setNome(e.target.value)}
            onBlur={(e) => {
              salvar(e.target.value);
              setRenomeando(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenomeando(false);
            }}
            className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base font-semibold text-texto"
          />
        </label>
      ) : (
        <Link href={`/app/${slug}/grupos/${g.id}`} className="flex flex-col gap-1 hover:text-marca-forte">
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            {nome}
            <span className="rounded-full bg-marca-clara px-2 py-0.5 text-xs font-semibold text-marca-forte">
              {n} {n === 1 ? "pessoa" : "pessoas"}
            </span>
            {!g.ativo ? <Selo>Pausado</Selo> : null}
            {estado === "salvo" ? <SinalSalvo estado={estado} erro="" /> : null}
          </span>
          {g.tema ? <span className="text-sm text-texto">{g.tema}</span> : null}
          <span className="text-sm text-suave">
            {n ? `${previa.join(", ")}${n > 3 ? ` e mais ${n - 3}` : ""}` : "Nenhum e-mail cadastrado: a devolutiva não tem para quem ir."}
          </span>
        </Link>
      )}
      {estado === "erro" && !renomeando ? <SinalSalvo estado={estado} erro={erro} /> : null}
      {n > GRANDE ? (
        <p role="note" className="rounded-xl bg-alerta-fundo px-3 py-2 text-sm text-alerta">
          {n} pessoas num cadastro só: a devolutiva iria para todas elas. Parece a turma inteira, não {generoDe(palavra) === "f" ? "uma" : "um"} {palavra.toLowerCase()}.
          {doMoodle ? " Toque em “Buscar entregas agora” no Moodle para trazer as equipes de verdade." : " Separe as pessoas em cadastros menores."}
        </p>
      ) : null}
      {n ? (
        <details className="group text-sm">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl px-1 font-medium text-marca-forte hover:underline [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
            Ver {n === 1 ? "a pessoa e o e-mail" : `as ${n} pessoas e os e-mails`}
          </summary>
          <ul className="mt-1 flex max-h-80 flex-col divide-y divide-borda overflow-y-auto rounded-xl border border-borda">
            {pessoas.map((p) => (
              <li key={p.email} className="flex flex-col px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="font-medium">{p.nome || "Sem nome"}</span>
                <span className="break-all text-xs text-suave sm:text-sm">{p.email}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-suave">A devolutiva vai para todos estes e-mails.</p>
        </details>
      ) : null}
      {podeGerir ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-2">
          <button
            type="button"
            onClick={() => setRenomeando(true)}
            className="inline-flex min-h-11 items-center rounded-xl border border-borda px-3 text-sm font-medium text-marca-forte hover:bg-fundo"
          >
            Renomear
          </button>
          <Link href={`/app/${slug}/grupos/${g.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-borda px-3 text-sm font-medium text-marca-forte hover:bg-fundo">
            Editar pessoas
          </Link>
          <BotaoConfirmar
            acao={apagarGrupo.bind(null, slug, g.id)}
            pergunta={
              doMoodle
                ? `Apagar “${nome}”? Some daqui e o Moodle não traz de volta. Dá para desfazer em “Apagadas”, no fim da lista.`
                : `Apagar “${nome}”? As entregas dela também são apagadas. Isso não pode ser desfeito.`
            }
          >
            Apagar {palavra.toLowerCase()}
          </BotaoConfirmar>
        </div>
      ) : null}
    </li>
  );
}

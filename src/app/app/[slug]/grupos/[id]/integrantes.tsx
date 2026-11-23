"use client";

import { useState } from "react";
import { SinalSalvo, useSalvar } from "@/components/campo-auto";
import { salvarIntegrante } from "../acoes";

export type Integrante = { id: string; email: string; nome: string; matricula: string };

function iniciais(nome: string, email: string) {
  const partes = (nome || email.split("@")[0]).split(/[\s._-]+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "?") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

function CampoIntegrante({ slug, id, campo, rotulo, valor, aoMudar }: { slug: string; id: string; campo: "nome" | "matricula"; rotulo: string; valor: string; aoMudar: (v: string) => void }) {
  const { salvar, estado, erro } = useSalvar(slug, `${campo}-${id}`, valor, (v) => salvarIntegrante(slug, id, campo, v));
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between gap-2 text-xs text-suave">
        {rotulo}
        <SinalSalvo estado={estado} erro={erro} />
      </span>
      <input
        defaultValue={valor}
        maxLength={campo === "nome" ? 200 : 40}
        onChange={(e) => aoMudar(e.target.value)}
        onBlur={(e) => salvar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
      />
    </label>
  );
}

function Linha({ slug, i, rotuloMatricula, podeEditar }: { slug: string; i: Integrante; rotuloMatricula: string; podeEditar: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(i.nome);
  const [matricula, setMatricula] = useState(i.matricula);
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-3.5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-marca-clara text-xs font-bold text-marca-forte">
          {iniciais(nome, i.email)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{nome || "Sem nome"}</span>
          <span className="truncate text-xs text-suave">{i.email}</span>
        </span>
        {podeEditar ? (
          <button
            type="button"
            aria-expanded={aberto}
            aria-label={`${aberto ? "Fechar" : "Editar"} ${nome || i.email}`}
            onClick={() => setAberto((x) => !x)}
            className="min-h-10 rounded-xl border border-borda px-3 text-sm font-semibold text-marca-forte hover:bg-fundo"
          >
            {aberto ? "Pronto" : "Editar"}
          </button>
        ) : null}
      </div>
      {!aberto && matricula ? (
        <span className="text-sm text-suave">
          {rotuloMatricula} <strong className="text-texto tabular-nums">{matricula}</strong>
        </span>
      ) : null}
      {aberto ? (
        <div className="entra flex flex-col gap-2">
          <CampoIntegrante slug={slug} id={i.id} campo="nome" rotulo="Nome" valor={nome} aoMudar={setNome} />
          <CampoIntegrante slug={slug} id={i.id} campo="matricula" rotulo={`${rotuloMatricula} (opcional)`} valor={matricula} aoMudar={setMatricula} />
        </div>
      ) : null}
    </li>
  );
}

/** Quem está no cadastro: nome (aparece em tudo), e-mail e a matrícula opcional. */
export function Integrantes({ slug, lista, rotuloMatricula, podeEditar, doMoodle }: { slug: string; lista: Integrante[]; rotuloMatricula: string; podeEditar: boolean; doMoodle: boolean }) {
  return (
    <section aria-label="Integrantes" className="flex flex-col gap-2">
      <h3 className="font-semibold">Integrantes</h3>
      {doMoodle ? <p className="rounded-xl bg-marca-clara px-3 py-2 text-sm text-marca-forte">Os nomes vieram do Moodle. Você pode corrigir aqui.</p> : null}
      <ul className="flex flex-col gap-2">
        {lista.map((i) => (
          <Linha key={i.id} slug={slug} i={i} rotuloMatricula={rotuloMatricula} podeEditar={podeEditar} />
        ))}
      </ul>
    </section>
  );
}

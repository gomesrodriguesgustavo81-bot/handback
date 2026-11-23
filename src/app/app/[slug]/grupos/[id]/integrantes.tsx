"use client";

import { useState } from "react";
import { SinalSalvo, useSalvar } from "@/components/campo-auto";
import { BotaoConfirmar, FormAcao } from "@/components/form-acao";
import { Campo } from "@/components/ui";
import { adicionarIntegrante, removerIntegrante, salvarIntegrante } from "../acoes";

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

function Linha({ slug, i, rotuloMatricula, podeEditar, podeTirar }: { slug: string; i: Integrante; rotuloMatricula: string; podeEditar: boolean; podeTirar: boolean }) {
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
          <span className="font-semibold">{nome || i.email.split("@")[0]}</span>
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
          {podeTirar ? (
            <BotaoConfirmar acao={removerIntegrante.bind(null, slug, i.id)} pergunta={`Tirar ${nome || i.email}? Deixa de receber a devolutiva.`}>
              Tirar desta lista
            </BotaoConfirmar>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Quem está no cadastro: nome (aparece em tudo), e-mail e a matrícula opcional. */
export function Integrantes({
  slug,
  grupoId,
  lista,
  rotuloMatricula,
  podeEditar,
  doMoodle,
}: {
  slug: string;
  grupoId: string;
  lista: Integrante[];
  rotuloMatricula: string;
  podeEditar: boolean;
  doMoodle: boolean;
}) {
  return (
    <section aria-label="Pessoas" className="flex flex-col gap-2">
      <h3 className="font-semibold">
        Pessoas ({lista.length})
      </h3>
      <p className="text-sm text-suave">Todas recebem a devolutiva. Qualquer uma pode mandar a entrega.</p>
      {doMoodle ? (
        <p className="rounded-xl bg-marca-clara px-3 py-2 text-sm text-marca-forte">
          Os nomes vieram do Moodle. Você pode corrigir nome e matrícula aqui. Quem entra e quem sai é o Moodle que decide: mude lá e toque em “Buscar entregas agora”.
        </p>
      ) : null}
      {lista.length ? (
        <ul className="flex flex-col gap-2">
          {lista.map((i) => (
            <Linha key={i.id} slug={slug} i={i} rotuloMatricula={rotuloMatricula} podeEditar={podeEditar} podeTirar={podeEditar && !doMoodle} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-borda px-3 py-3 text-sm text-suave">Ninguém ainda: a devolutiva não tem para quem ir.</p>
      )}
      {podeEditar && !doMoodle ? (
        <details className="rounded-2xl border border-borda bg-cartao p-3.5">
          <summary className="flex min-h-10 cursor-pointer items-center font-semibold text-marca-forte">+ Adicionar pessoa</summary>
          <div className="mt-2">
            <FormAcao acao={adicionarIntegrante.bind(null, slug, grupoId)} textoBotao="Adicionar pessoa" limparAoSalvar>
              <Campo rotulo="Nome" name="nome" placeholder="Ex.: Ana Souza" />
              <Campo rotulo="E-mail" name="email" type="email" required placeholder="ana@email.com" />
            </FormAcao>
          </div>
        </details>
      ) : null}
    </section>
  );
}

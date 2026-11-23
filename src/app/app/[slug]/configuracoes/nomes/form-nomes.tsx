"use client";

import { useState } from "react";
import { CampoAuto } from "@/components/campo-auto";
import { plural } from "@/lib/nomes";

type Palavras = { organizacao: string; espaco: string; etapa: string; grupo: string; pessoa: string; avaliador: string; matricula: string };

const CAMPOS: { chave: keyof Palavras; rotulo: string; dica: string }[] = [
  { chave: "organizacao", rotulo: "Como você chama este espaço?", dica: "Ex.: Escola, Escritório, Time, Hub, Agência" },
  { chave: "espaco", rotulo: "Cada turma, programa ou projeto", dica: "Ex.: Turma, Programa, Projeto, Cliente" },
  { chave: "etapa", rotulo: "Cada etapa de entrega", dica: "Ex.: Aula, Sprint, Ciclo, Encontro" },
  { chave: "grupo", rotulo: "Quem entrega junto", dica: "Ex.: Equipe, Squad, Time, Grupo" },
  { chave: "pessoa", rotulo: "Cada pessoa", dica: "Ex.: Aluno, Residente, Colaborador" },
  { chave: "avaliador", rotulo: "Quem avalia", dica: "Ex.: Professor, Gestor, Mentor" },
  { chave: "matricula", rotulo: "Nome do número de identificação (opcional)", dica: "Ex.: Matrícula, nº USP, RA" },
];

/** Nomes do dia a dia, com a prévia do topo e das abas mudando enquanto a pessoa digita. Salva sozinho. */
export function FormNomes({ slug, nome, inicial }: { slug: string; nome: string; inicial: Palavras }) {
  const [p, setP] = useState(inicial);
  const [nomeAtual, setNomeAtual] = useState(nome);
  const min = (x: string) => x.trim().toLowerCase();
  const artigo = /a$|ção$|dade$/i.test(p.organizacao.trim()) ? "a" : "o";
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Prévia" className="flex flex-col gap-3 rounded-2xl bg-marca-forte p-4 text-white dark:bg-marca-clara dark:text-texto">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-acento">Assim fica o topo</span>
        <span className="titulo text-lg font-bold">handback / {nomeAtual || "…"}</span>
        <span className="text-xs opacity-85">
          Trocar de {min(p.organizacao)} · Configurações d{artigo} {min(p.organizacao)}
        </span>
        <span className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-acento px-3 py-1 text-[13px] font-bold text-sobre-acento">Entregas</span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold">{plural(p.etapa) || "…"}</span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold">{plural(p.grupo) || "…"}</span>
        </span>
      </section>
      <CampoAuto slug={slug} campo="nome" rotulo={`Nome d${artigo} ${min(p.organizacao)}`} valor={nome} maximo={120} aoMudar={setNomeAtual} dica="Ex.: Escola Alfa, Escritório Souza & Lima, Squad Mobile" />
      {CAMPOS.map((c) => (
        <CampoAuto
          key={c.chave}
          slug={slug}
          campo={`palavra_${c.chave}`}
          rotulo={c.rotulo}
          valor={inicial[c.chave]}
          maximo={40}
          dica={c.dica}
          aoMudar={(v) => setP((x) => ({ ...x, [c.chave]: v }))}
        />
      ))}
      <p className="text-xs text-suave">Salva sozinho quando você sai do campo. Escreva no singular: o plural é feito sozinho.</p>
    </div>
  );
}

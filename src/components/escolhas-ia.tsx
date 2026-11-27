"use client";

import { useState } from "react";
import type { EscolhasIA } from "@/lib/ia/escolhas";

function Chave({ nome, rotulo, ajuda, marcada, aoMudar }: { nome: string; rotulo: string; ajuda: string; marcada: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-borda pt-3 first:border-t-0 first:pt-0">
      <span className="flex min-w-0 flex-col text-sm">
        <b>{rotulo}</b>
        <span className="text-xs leading-snug text-suave">{ajuda}</span>
      </span>
      {/* Vai no formulário como "on" quando ligada. */}
      {marcada ? <input type="hidden" name={nome} value="on" /> : null}
      <button
        type="button"
        role="switch"
        aria-checked={marcada}
        aria-label={rotulo}
        onClick={() => aoMudar(!marcada)}
        className={`relative h-8 w-[52px] shrink-0 rounded-2xl transition-colors ${marcada ? "bg-marca" : "bg-borda"}`}
      >
        <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-[left] ${marcada ? "left-[26px]" : "left-1"}`} />
      </button>
    </div>
  );
}

/**
 * As escolhas de como a IA ajuda e de proteção dos dados dos alunos. Os campos têm nome e entram em
 * qualquer formulário; `aoMudar` serve a quem guarda o estado por fora (o primeiro acesso).
 */
export function EscolhasIACampos({ valores, aoMudar }: { valores: EscolhasIA; aoMudar?: (v: EscolhasIA) => void }) {
  const [v, setV] = useState<EscolhasIA>(valores);
  const mudar = (p: Partial<EscolhasIA>) => {
    const novo = { ...v, ...p };
    setV(novo);
    aoMudar?.(novo);
  };
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
        <legend className="px-1 text-[15px] font-bold">Quem decide o conceito</legend>
        <label className={`flex min-h-12 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${!v.semSugestao ? "border-2 border-marca bg-marca-clara" : "border-borda"}`}>
          <input type="radio" name="modo" value="sugere" checked={!v.semSugestao} onChange={() => mudar({ semSugestao: false })} className="mt-1 size-4" />
          <span>
            <b>A IA sugere o conceito</b> <span className="text-xs text-suave">(padrão)</span>
            <br />
            <span className="text-xs leading-snug text-suave">A sugestão aparece como rascunho; o conceito é seu.</span>
          </span>
        </label>
        <label className={`flex min-h-12 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${v.semSugestao ? "border-2 border-marca bg-marca-clara" : "border-borda"}`}>
          <input type="radio" name="modo" value="sem" checked={v.semSugestao} onChange={() => mudar({ semSugestao: true })} className="mt-1 size-4" />
          <span>
            <b>Sem sugestão de conceito</b>
            <br />
            <span className="text-xs leading-snug text-suave">A IA só confere o checklist e escreve o rascunho. Boa escolha se a sua instituição pedir.</span>
          </span>
        </label>
        <Chave nome="exigir" rotulo="Exigir que eu escolha o conceito" ajuda="Só dá para aprovar depois de escolher. Desligado, a sugestão da IA já vem marcada." marcada={v.exigirConceito} aoMudar={(x) => mudar({ exigirConceito: x })} />
        <Chave nome="motivo" rotulo="Pedir o motivo quando eu mudar o conceito" ajuda="Fica no registro de supervisão. Desligado, é opcional." marcada={v.pedirMotivo} aoMudar={(x) => mudar({ pedirMotivo: x })} />
      </fieldset>

      <fieldset className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
        <legend className="px-1 text-[15px] font-bold">Dados dos alunos</legend>
        <Chave nome="codigo" rotulo="Trocar o nome por um código" ajuda="A IA lê “Equipe 3F9K” em vez do nome. Você continua vendo o nome na tela." marcada={v.nomeCodigo} aoMudar={(x) => mudar({ nomeCodigo: x })} />
        <Chave nome="esconder" rotulo="Esconder e-mail, telefone e CPF" ajuda="No texto enviado à IA esses dados viram marcas. Também escondemos os nomes por inteiro que estão no cadastro." marcada={v.esconderDados} aoMudar={(x) => mudar({ esconderDados: x })} />
        <p className="rounded-xl bg-alerta-fundo px-3 py-2.5 text-xs leading-relaxed text-alerta">
          <b>O que não dá para esconder:</b> PDF e imagens vão inteiros para a IA. Peça aos alunos que não coloquem dados pessoais nos trabalhos. Quando o Handback achar telefone ou CPF, aparece um alerta para você.
        </p>
      </fieldset>
    </div>
  );
}

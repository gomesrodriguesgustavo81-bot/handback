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

/**
 * Um cadastro da lista, fechado por padrão: nome, quantas pessoas e a prévia.
 * Tocando, abre e mostra as pessoas com os e-mails e as ações.
 */
export function CartaoGrupo({
  slug,
  g,
  podeGerir,
  palavra,
  doMoodle,
  aberto,
  alternar,
  selecionando = false,
  marcado = false,
  marcar,
  realce = "",
}: {
  slug: string;
  g: { id: string; nome: string; tema: string | null; ativo: boolean; pessoas: Pessoa[] };
  podeGerir: boolean;
  palavra: string;
  doMoodle: boolean;
  aberto: boolean;
  alternar: () => void;
  selecionando?: boolean;
  marcado?: boolean;
  marcar?: () => void;
  /** Trecho procurado (os nomes que batem ficam em destaque). */
  realce?: string;
}) {
  const [renomeando, setRenomeando] = useState(false);
  const [nome, setNome] = useState(g.nome);
  const { salvar, estado, erro } = useSalvar(slug, `grupo-${g.id}`, g.nome, (v) => renomearGrupo(slug, g.id, v));
  const pessoas = [...g.pessoas].sort((a, b) => (a.nome || a.email).localeCompare(b.nome || b.email, "pt-BR"));
  const n = pessoas.length;
  const previa = pessoas.slice(0, 3).map((p) => p.nome || p.email.split("@")[0]);
  const bate = (texto: string) => Boolean(realce) && semAcento(texto).includes(realce);

  const cabeca = (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
      <span className="flex flex-wrap items-center gap-2 font-semibold">
        {nome}
        <span className="rounded-full bg-marca-clara px-2 py-0.5 text-xs font-semibold text-marca-forte">
          {n} {n === 1 ? "pessoa" : "pessoas"}
        </span>
        {!g.ativo ? <Selo>Pausado</Selo> : null}
        {estado === "salvo" ? <SinalSalvo estado={estado} erro="" /> : null}
      </span>
      <span className="truncate text-sm font-normal text-suave">
        {n ? `${previa.join(", ")}${n > 3 ? ` e mais ${n - 3}` : ""}` : "Nenhum e-mail cadastrado: a devolutiva não tem para quem ir."}
      </span>
    </span>
  );

  return (
    <li className={`flex flex-col rounded-2xl border bg-cartao ${marcado ? "border-marca ring-2 ring-marca/30" : "border-borda"}`}>
      {renomeando ? (
        <label className="flex flex-col gap-1 p-4">
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
      ) : selecionando ? (
        <label className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-2.5">
          <input type="checkbox" checked={marcado} onChange={marcar} aria-label={`Selecionar ${nome}`} className="size-5 shrink-0 accent-[var(--marca)]" />
          {cabeca}
        </label>
      ) : (
        <button type="button" aria-expanded={aberto} onClick={alternar} className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 hover:text-marca-forte">
          {cabeca}
          <span aria-hidden className={`shrink-0 text-xl text-suave transition-transform ${aberto ? "rotate-90" : ""}`}>
            ›
          </span>
        </button>
      )}
      {estado === "erro" && !renomeando ? (
        <div className="px-4 pb-2">
          <SinalSalvo estado={estado} erro={erro} />
        </div>
      ) : null}

      {aberto && !selecionando ? (
        <div className="entra flex flex-col gap-2 border-t border-borda px-4 pt-2 pb-3">
          {g.tema ? <span className="text-sm text-texto">{g.tema}</span> : null}
          {n > GRANDE ? (
            <p role="note" className="rounded-xl bg-alerta-fundo px-3 py-2 text-sm text-alerta">
              {n} pessoas num cadastro só: a devolutiva iria para todas elas. Parece a turma inteira, não {generoDe(palavra) === "f" ? "uma" : "um"} {palavra.toLowerCase()}.
              {doMoodle ? " Toque em “Buscar entregas agora” no Moodle para trazer as equipes de verdade." : " Separe as pessoas em cadastros menores."}
            </p>
          ) : null}
          {n ? (
            <>
              <ul aria-label={`Pessoas de ${nome}`} className="flex max-h-80 flex-col divide-y divide-borda overflow-y-auto text-sm">
                {pessoas.map((p) => (
                  <li key={p.email} className="flex flex-col py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className={`font-medium ${bate(`${p.nome} ${p.email}`) ? "rounded bg-acento/60 px-1 text-texto" : ""}`}>{p.nome || p.email.split("@")[0]}</span>
                    <span className="break-all text-xs text-suave sm:text-sm">{p.email}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-suave">A devolutiva vai para todos estes e-mails.</p>
            </>
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
        </div>
      ) : null}
    </li>
  );
}

/** Minúsculas e sem acentos (para a busca). */
export function semAcento(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

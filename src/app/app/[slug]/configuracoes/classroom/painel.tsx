"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirmar } from "@/components/confirmar";
import { Aviso, Botao } from "@/components/ui";
import { buscarNoClassroom, desligarClassroom, ligarClassroom } from "./acoes";

type Msg = { ok: boolean; mensagem: string } | null;

/** Escolher qual turma do Classroom é a turma atual do Handback. */
export function EscolherTurma({ slug, turma, cursos }: { slug: string; turma: string; cursos: { id: string; nome: string; detalhe: string }[] }) {
  const router = useRouter();
  const { pedir, janela } = useConfirmar();
  const [escolhido, setEscolhido] = useState(cursos[0]?.id ?? "");
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const nome = cursos.find((c) => c.id === escolhido)?.nome ?? "";
  return (
    <div className="flex flex-col gap-2">
      <fieldset className="flex flex-col gap-2" disabled={pendente}>
        <legend className="sr-only">Turmas do seu Classroom</legend>
        {cursos.map((c) => (
          <label
            key={c.id}
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${escolhido === c.id ? "border-marca bg-marca-clara" : "border-borda bg-cartao"}`}
          >
            <input type="radio" name="curso" value={c.id} checked={escolhido === c.id} onChange={() => setEscolhido(c.id)} className="size-5 shrink-0 accent-[var(--marca)]" />
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{c.nome}</span>
              {c.detalhe ? <span className="text-xs text-suave">{c.detalhe}</span> : null}
            </span>
          </label>
        ))}
      </fieldset>
      <Botao
        type="button"
        className="self-start"
        disabled={pendente || !escolhido}
        onClick={async () => {
          if (
            !(await pedir({
              titulo: "Ligar ao Classroom?",
              texto: `A turma ${turma} passa a receber os alunos, as tarefas e as entregas de “${nome}”.`,
              sim: "Sim, ligar",
            }))
          )
            return;
          iniciar(async () => {
            setMsg(await ligarClassroom(slug, escolhido));
            router.refresh();
          });
        }}
      >
        {pendente ? "Ligando e buscando…" : "Ligar esta turma"}
      </Botao>
      {msg ? <Aviso tipo={msg.ok ? "info" : "erro"}>{msg.mensagem}</Aviso> : null}
      {janela}
    </div>
  );
}

/** "Buscar agora" e "Desligar" de uma turma já ligada. */
export function AcoesLigada({ slug, podeDesligar }: { slug: string; podeDesligar: boolean }) {
  const router = useRouter();
  const { pedir, janela } = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Botao
          type="button"
          variante="secundario"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              setMsg(await buscarNoClassroom(slug));
              router.refresh();
            })
          }
        >
          {pendente ? "Buscando…" : "Buscar agora"}
        </Botao>
        {podeDesligar ? (
          <Botao
            type="button"
            variante="secundario"
            disabled={pendente}
            className="text-erro"
            onClick={async () => {
              if (
                !(await pedir({
                  titulo: "Desligar do Classroom?",
                  texto: "O Handback para de buscar no Classroom. Os ciclos, alunos e entregas que já vieram continuam aqui.",
                  sim: "Sim, desligar",
                  perigo: true,
                }))
              )
                return;
              iniciar(async () => {
                setMsg(await desligarClassroom(slug));
                router.refresh();
              });
            }}
          >
            Desligar
          </Botao>
        ) : null}
      </div>
      {msg ? <Aviso tipo={msg.ok ? "info" : "erro"}>{msg.mensagem}</Aviso> : null}
      {janela}
    </div>
  );
}

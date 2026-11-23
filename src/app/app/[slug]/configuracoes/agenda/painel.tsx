"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SinalSalvo, useSalvar } from "@/components/campo-auto";
import { useConfirmar } from "@/components/confirmar";
import { Aviso } from "@/components/ui";
import { ligarAgenda, salvarAgenda } from "./acoes";

export function LigarAgenda({ slug, ligada, turma, podeLigar, deOutro }: { slug: string; ligada: boolean; turma: string; podeLigar: boolean; deOutro: string | null }) {
  const router = useRouter();
  const { pedir, janela } = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; mensagem: string } | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <label className={`flex min-h-12 items-center justify-between gap-3 ${podeLigar || ligada ? "cursor-pointer" : "opacity-60"}`}>
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">Pôr os prazos na minha agenda</span>
          <span className="text-xs text-suave">Cria a agenda “Handback · {turma}” na sua conta Google.</span>
        </span>
        <input
          type="checkbox"
          checked={ligada}
          disabled={pendente || (!podeLigar && !ligada)}
          onChange={async (e) => {
            const ligar = e.target.checked;
            const ok = await pedir(
              ligar
                ? {
                    titulo: deOutro ? "Passar a agenda para a sua conta?" : "Criar a agenda da turma na sua conta?",
                    texto: deOutro
                      ? `A agenda sai da conta de ${deOutro} e é criada na sua, com os prazos da turma.`
                      : `O Handback cria a agenda “Handback · ${turma}” no seu Google Agenda, com os prazos da turma.`,
                    sim: "Sim, criar",
                  }
                : { titulo: "Desligar a agenda da turma?", texto: `A agenda “Handback · ${turma}” é apagada da sua conta Google, com os eventos.`, sim: "Sim, desligar", perigo: true },
            );
            if (!ok) return;
            iniciar(async () => {
              setMsg(await ligarAgenda(slug, ligar));
              router.refresh();
            });
          }}
          className="size-6 shrink-0 accent-[var(--marca)]"
        />
      </label>
      {pendente ? <p className="text-sm text-suave">Falando com o Google Agenda…</p> : null}
      {msg ? <Aviso tipo={msg.ok ? "info" : "erro"}>{msg.mensagem}</Aviso> : null}
      {janela}
    </div>
  );
}

function CaixaItem({ slug, campo, nome, detalhe, inicial, pergunta }: { slug: string; campo: string; nome: string; detalhe: string; inicial: boolean; pergunta?: { ligar: string; texto: string } }) {
  const [marcado, setMarcado] = useState(inicial);
  const { salvar, estado, erro } = useSalvar(slug, `agenda_${campo}`, inicial ? "sim" : "nao", (v) => salvarAgenda(slug, campo, v));
  const { pedir, janela } = useConfirmar();
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 border-t border-borda py-1 text-sm first-of-type:border-t-0">
      {janela}
      <input
        type="checkbox"
        checked={marcado}
        onChange={async (e) => {
          const v = e.target.checked;
          if (pergunta && v && !(await pedir({ titulo: pergunta.ligar, texto: pergunta.texto, sim: "Sim, ligar" }))) return;
          setMarcado(v);
          salvar(v ? "sim" : "nao");
        }}
        className="size-[22px] shrink-0 accent-[var(--marca)]"
      />
      <span className="flex flex-col">
        <span className="flex flex-wrap items-center gap-2">
          {nome}
          <SinalSalvo estado={estado} erro={erro} />
        </span>
        <span className="text-xs text-suave">{detalhe}</span>
      </span>
    </label>
  );
}

export function ItensAgenda({ slug, itens, convidar, palavraEtapa }: { slug: string; itens: string[]; convidar: boolean; palavraEtapa: string }) {
  const et = palavraEtapa.toLowerCase();
  return (
    <>
      <section aria-label="O que entra" className="flex flex-col rounded-2xl border border-borda bg-cartao p-4">
        <h2 className="mb-1 font-semibold">O que entra</h2>
        <CaixaItem slug={slug} campo="prazo" nome={`Prazo de cada ${et}`} detalhe="Evento no dia, com lembrete 1 dia antes" inicial={itens.includes("prazo")} />
        <CaixaItem slug={slug} campo="abre" nome="Quando abre para entregas" detalhe="Evento no dia que abre" inicial={itens.includes("abre")} />
        <CaixaItem slug={slug} campo="aula" nome={`O dia d${/a$/i.test(et) ? "a" : "o"} ${et}`} detalhe="Se tiver data cadastrada" inicial={itens.includes("aula")} />
      </section>
      <section aria-label="Alunos" className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
        <CaixaItem
          slug={slug}
          campo="convidar"
          nome="Convidar os alunos"
          detalhe="Cada aluno recebe o convite do Google e vê o abre e o prazo na agenda dele."
          inicial={convidar}
          pergunta={{ ligar: "Convidar os alunos para os eventos?", texto: "O Google manda um convite por e-mail para cada aluno. No convite, os alunos veem o e-mail uns dos outros." }}
        />
        <p className="rounded-xl bg-alerta-fundo px-3 py-2 text-xs text-alerta">No convite do Google Agenda os alunos veem o e-mail uns dos outros. Use só se a turma já se conhece.</p>
      </section>
    </>
  );
}

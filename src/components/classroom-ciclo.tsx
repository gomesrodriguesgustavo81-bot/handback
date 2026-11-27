"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { prepararEscolha, publicarCiclo, trazerArquivos } from "@/app/app/[slug]/configuracoes/classroom/acoes";
import { useConfirmar } from "./confirmar";
import { Aviso, Botao } from "./ui";

/* A janela oficial do Google para escolher arquivos (Google Picker). */
type Picker = {
  DocsView: new (id?: string) => { setFileIds(ids: string): unknown; setMode(m: string): unknown };
  PickerBuilder: new () => Record<string, (...a: unknown[]) => unknown>;
  ViewId: { DOCS: string };
  DocsViewMode: { LIST: string };
  Feature: { MULTISELECT_ENABLED: string };
  Action: { PICKED: string; CANCEL: string };
};
declare global {
  interface Window {
    gapi?: { load(nome: string, pronto: () => void): void };
    google?: { picker?: Picker };
  }
}

function carregarPicker(): Promise<Picker> {
  return new Promise((ok, erro) => {
    const pronto = () => window.gapi!.load("picker", () => (window.google?.picker ? ok(window.google.picker) : erro(new Error("sem picker"))));
    if (window.gapi) return pronto();
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.async = true;
    s.onload = pronto;
    s.onerror = () => erro(new Error("não carregou"));
    document.head.appendChild(s);
  });
}

function abrirPicker(p: Picker, e: { acesso: string; chave: string; app: string; ids: string[] }): Promise<string[]> {
  return new Promise((ok) => {
    const view = new p.DocsView(p.ViewId.DOCS);
    view.setFileIds(e.ids.join(","));
    view.setMode(p.DocsViewMode.LIST);
    const b = new p.PickerBuilder();
    for (const [m, a] of [
      ["addView", view],
      ["enableFeature", p.Feature.MULTISELECT_ENABLED],
      ["setOAuthToken", e.acesso],
      ["setDeveloperKey", e.chave],
      ["setAppId", e.app],
      ["setLocale", "pt-BR"],
      ["setTitle", "Marque todos os arquivos e toque em Selecionar"],
      [
        "setCallback",
        (d: { action: string; docs?: { id: string }[] }) => {
          if (d.action === p.Action.PICKED) ok((d.docs ?? []).map((x) => x.id));
          else if (d.action === p.Action.CANCEL) ok([]);
        },
      ],
    ] as const)
      b[m](a);
    (b.build() as { setVisible(v: boolean): void }).setVisible(true);
  });
}

type Info = {
  tarefa: boolean;
  nosso: boolean;
  link: string;
  entregaram: number;
  noHandback: number;
  esperando: number;
  soLink: number;
  meu: boolean;
  podePublicar: boolean;
  semChecklist: boolean;
};

/** Cartão do Classroom na página do ciclo: números, trazer os arquivos e publicar a tarefa. */
export function ClassroomDoCiclo({ slug, etapaId, info }: { slug: string; etapaId: string; info: Info }) {
  const router = useRouter();
  const { pedir, janela } = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [andamento, setAndamento] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; mensagem: string; erros?: string[] } | null>(null);
  const [simulada, setSimulada] = useState<{ ids: string[]; marcados: boolean; responder: (ids: string[]) => void } | null>(null);

  async function trazer() {
    setMsg(null);
    const e = await prepararEscolha(slug, etapaId);
    if (!e.ok) return setMsg(e);
    let escolhidos: string[];
    try {
      escolhidos = e.simular
        ? await new Promise<string[]>((ok) => setSimulada({ ids: e.ids, marcados: false, responder: ok }))
        : await abrirPicker(await carregarPicker(), e);
    } catch {
      return setMsg({ ok: false, mensagem: "A janela do Google não abriu. Confira a internet e tente de novo." });
    }
    if (!escolhidos.length) return;
    let trazidos = 0;
    const erros: string[] = [];
    for (let i = 0; i < escolhidos.length; i += 5) {
      setAndamento(`Trazendo ${Math.min(i + 5, escolhidos.length)} de ${escolhidos.length}…`);
      const r = await trazerArquivos(slug, etapaId, escolhidos.slice(i, i + 5));
      if (!r.ok) {
        erros.push(r.mensagem);
        break;
      }
      trazidos += r.trazidos ?? 0;
      erros.push(...(r.erros ?? []));
    }
    setAndamento("");
    setMsg({ ok: trazidos > 0, mensagem: trazidos ? `${trazidos} ${trazidos === 1 ? "arquivo chegou" : "arquivos chegaram"}. Já dá para analisar.` : "Nenhum arquivo chegou.", erros });
    router.refresh();
  }

  const caixa = "flex flex-col gap-0.5 rounded-2xl border p-3";
  return (
    <section aria-label="Google Classroom" className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Google Classroom</h2>
        {info.tarefa ? (
          <span className="inline-flex items-center rounded-full bg-marca-clara px-2.5 py-0.5 text-xs font-medium text-marca-forte">
            {info.nosso ? "Tarefa publicada pelo Handback" : "Tarefa do Classroom"}
          </span>
        ) : null}
      </div>

      {!info.tarefa ? (
        <>
          <p className="text-sm text-suave">Esta entrega ainda não está no Classroom. Publicando por aqui, o Handback consegue lançar as notas lá depois.</p>
          {info.podePublicar ? (
            <Botao
              type="button"
              className="self-start"
              disabled={pendente}
              onClick={async () => {
                if (!(await pedir({ titulo: "Publicar no Classroom?", texto: "A tarefa aparece para os alunos no Classroom, com o prazo e o que entregar. Vale nota até 10.", sim: "Sim, publicar" })))
                  return;
                iniciar(async () => {
                  setMsg(await publicarCiclo(slug, etapaId));
                  router.refresh();
                });
              }}
            >
              {pendente ? (
          <>
            <span aria-hidden className="rodinha" />
            Publicando…
          </>
        ) : (
          "Publicar no Classroom"
        )}
            </Botao>
          ) : (
            <p className="text-xs text-suave">Só quem ligou a turma ao Classroom pode publicar.</p>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <span className={`${caixa} border-borda`}>
              <b className="titulo text-xl">{info.entregaram}</b>
              <span className="text-xs text-suave">{info.entregaram === 1 ? "entrega" : "entregas"}</span>
            </span>
            <span className={`${caixa} ${info.esperando ? "border-alerta/30 bg-alerta-fundo text-alerta" : "border-borda"}`}>
              <b className="titulo text-xl">{info.noHandback}</b>
              <span className="text-xs">arquivos no Handback</span>
            </span>
            <span className={`${caixa} border-borda`}>
              <b className="titulo text-xl">{info.soLink}</b>
              <span className="text-xs text-suave">só com link ou texto</span>
            </span>
          </div>
          {info.semChecklist ? (
            <Aviso tipo="alerta">Escreva logo abaixo o que deve ser entregue (checklist). A IA precisa dele para analisar as entregas.</Aviso>
          ) : null}
          {!info.nosso ? (
            <p className="text-xs text-suave">Tarefa criada direto no Classroom: a nota você lança lá. A devolutiva vai por e-mail.</p>
          ) : null}
          {info.esperando ? (
            <div className="flex flex-col gap-2 rounded-xl border border-alerta/30 bg-alerta-fundo p-3 text-alerta">
              <strong className="text-sm">
                {info.esperando} {info.esperando === 1 ? "arquivo está" : "arquivos estão"} no Drive dos alunos
              </strong>
              <span className="text-sm">O Google só deixa o Handback abrir os arquivos que você escolher. Toque abaixo, marque todos e toque em Selecionar.</span>
              {info.meu ? (
                <Botao type="button" className="self-start" disabled={Boolean(andamento)} onClick={trazer}>
                  {andamento || "Trazer os arquivos dos alunos"}
                </Botao>
              ) : (
                <span className="text-xs">Só quem ligou a turma ao Classroom pode trazer.</span>
              )}
            </div>
          ) : null}
          {info.link ? (
            <a href={info.link} target="_blank" rel="noopener noreferrer" className="self-start text-sm font-medium text-marca-forte underline">
              Abrir a tarefa no Classroom
            </a>
          ) : null}
        </>
      )}

      {msg ? (
        <Aviso tipo={msg.ok ? "info" : "erro"}>
          {msg.mensagem}
          {msg.erros?.length ? (
            <ul className="mt-1 list-disc pl-4">
              {msg.erros.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </Aviso>
      ) : null}
      {janela}

      {simulada ? (
        <div role="dialog" aria-modal="true" aria-label="Escolher arquivos" className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="entra flex w-full max-w-sm flex-col gap-2 rounded-2xl bg-cartao p-5">
            <h2 className="text-lg font-bold">Escolher arquivos (teste)</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {simulada.ids.map((id) => (
                <li key={id}>
                  {simulada.marcados ? "☑" : "☐"} {id}
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Botao type="button" variante="secundario" onClick={() => setSimulada({ ...simulada, marcados: !simulada.marcados })}>
                {simulada.marcados ? "Desmarcar" : "Marcar todos"}
              </Botao>
              <Botao
                type="button"
                onClick={() => {
                  simulada.responder(simulada.marcados ? simulada.ids : []);
                  setSimulada(null);
                }}
              >
                Selecionar
              </Botao>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

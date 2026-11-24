"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { devolverNoClassroomAcao } from "@/app/app/[slug]/configuracoes/classroom/acoes";
import { enviarDevolutivaPorEmail } from "@/app/app/[slug]/entregas/acoes";
import { devolverNoMoodleAcao } from "@/app/app/[slug]/moodle/acoes";
import { useConfirmar } from "@/components/confirmar";
import { Aviso, Botao } from "@/components/ui";

export type Caminho = { id: "classroom" | "moodle" | "email"; nome: string; detalhe: string; pode: boolean; porque?: string };

/**
 * Tela Enviar: escolhe por onde a devolutiva sai (Classroom, Moodle, e-mail)
 * e manda todas as aprovadas de uma vez, mostrando o andamento.
 */
export function EnviarTudo({
  slug,
  entregas,
  caminhos,
  conectarHref,
  voltar,
}: {
  slug: string;
  entregas: { id: string; nome: string }[];
  caminhos: Caminho[];
  conectarHref: string;
  voltar: string;
}) {
  const router = useRouter();
  const { pedir, janela } = useConfirmar();
  const [marcados, setMarcados] = useState(() => new Set(caminhos.filter((c) => c.pode).map((c) => c.id)));
  const [andando, setAndando] = useState(false);
  const [feitas, setFeitas] = useState(0);
  const [erros, setErros] = useState<string[]>([]);
  const [reconectar, setReconectar] = useState(false);
  const [pronto, setPronto] = useState<number | null>(null);
  const n = entregas.length;
  const escolhidos = caminhos.filter((c) => c.pode && marcados.has(c.id));

  const enviar = async () => {
    const nomes = escolhidos.map((c) => c.nome).join(" e ");
    if (!(await pedir({ titulo: `Enviar para ${n === 1 ? "1 aluno" : `${n} ${"alunos"}`}?`, texto: `As devolutivas aprovadas saem agora por: ${nomes}. Os alunos recebem na hora.`, sim: "Sim, enviar" }))) return;
    setAndando(true);
    setErros([]);
    setFeitas(0);
    setReconectar(false);
    let ok = 0;
    for (const e of entregas) {
      let saiu = false;
      for (const c of escolhidos) {
        const r =
          c.id === "classroom"
            ? await devolverNoClassroomAcao(slug, e.id)
            : c.id === "moodle"
              ? await devolverNoMoodleAcao(slug, e.id, true)
              : await enviarDevolutivaPorEmail(slug, e.id);
        if (r.ok) saiu = true;
        else {
          setErros((x) => [...x, `${e.nome} (${c.nome}): ${r.mensagem}`]);
          if ("reconectar" in r && r.reconectar) setReconectar(true);
        }
      }
      if (saiu) ok++;
      setFeitas((x) => x + 1);
    }
    setAndando(false);
    setPronto(ok);
    router.refresh();
  };

  if (pronto !== null) {
    return (
      <div className="flex flex-col gap-3">
        <div role="status" className="cresce flex flex-col items-center gap-2 rounded-2xl bg-ok-fundo p-6 text-center text-ok">
          <span aria-hidden className="text-3xl">✓</span>
          <b className="text-lg">{pronto === 1 ? "1 devolutiva enviada" : `${pronto} devolutivas enviadas`}</b>
        </div>
        {erros.length ? <ListaErros erros={erros} reconectar={reconectar} conectarHref={conectarHref} /> : null}
        <Link href={voltar} className="toque inline-flex min-h-12 items-center justify-center rounded-2xl bg-marca px-4 font-bold text-sobre-marca">
          Voltar para o ciclo
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
        <legend className="sr-only">Para onde vai</legend>
        <b className="text-sm">Para onde vai</b>
        {caminhos.map((c) => (
          <label key={c.id} className={`flex min-h-12 items-start gap-3 rounded-xl px-1 py-2 ${c.pode ? "cursor-pointer" : "opacity-60"}`}>
            <input
              type="checkbox"
              className="mt-1 size-5 accent-[var(--marca)]"
              checked={c.pode && marcados.has(c.id)}
              disabled={!c.pode || andando}
              onChange={(ev) =>
                setMarcados((x) => {
                  const novo = new Set(x);
                  if (ev.target.checked) novo.add(c.id);
                  else novo.delete(c.id);
                  return novo;
                })
              }
            />
            <span className="flex flex-col">
              <b className="text-[15px]">{c.nome}</b>
              <span className="text-[13px] text-suave">{c.pode ? c.detalhe : c.porque}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {janela}
      {erros.length ? <ListaErros erros={erros} reconectar={reconectar} conectarHref={conectarHref} /> : null}
      <Botao type="button" className="min-h-14 rounded-2xl text-base font-extrabold" disabled={andando || !escolhidos.length || !n} onClick={enviar}>
        {andando ? (
          <>
            <span aria-hidden className="rodinha" />
            Enviando {Math.min(feitas + 1, n)} de {n}…
          </>
        ) : (
          `Enviar para ${n === 1 ? "1 aluno" : `${n} alunos`}`
        )}
      </Botao>
      {!escolhidos.length ? <p className="text-center text-sm text-suave">Marque pelo menos um caminho.</p> : null}
    </div>
  );
}

function ListaErros({ erros, reconectar, conectarHref }: { erros: string[]; reconectar: boolean; conectarHref: string }) {
  return (
    <Aviso tipo="erro">
      <p className="font-semibold">Algumas não saíram:</p>
      <ul className="list-disc pl-4">
        {erros.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
      {reconectar ? (
        <a href={conectarHref} className="font-semibold underline">
          Conectar de novo
        </a>
      ) : null}
    </Aviso>
  );
}

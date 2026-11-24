"use client";
import { useConfirmar } from "./confirmar";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enviarDevolutivaPorEmail } from "@/app/app/[slug]/entregas/acoes";
import { devolverNoMoodleAcao } from "@/app/app/[slug]/moodle/acoes";
import { devolverNoClassroomAcao } from "@/app/app/[slug]/configuracoes/classroom/acoes";
import { Aviso, Botao } from "./ui";

type Msg = { ok: boolean; mensagem: string; reconectar?: boolean } | null;

function AvisoEnvio({ msg, conectarHref }: { msg: Msg; conectarHref: string }) {
  if (!msg) return null;
  return (
    <Aviso tipo={msg.ok ? "info" : "erro"}>
      {msg.mensagem}
      {msg.reconectar ? (
        <>
          {" "}
          <a href={conectarHref} className="font-semibold underline">
            Conectar meu Gmail
          </a>
        </>
      ) : null}
    </Aviso>
  );
}

/** Envia a devolutiva de uma entrega pelo Gmail conectado. */
export function BotaoEnviar({
  slug,
  entregaId,
  texto = "Enviar para a equipe",
  variante = "primario",
  conectarHref,
  perguntar,
}: {
  slug: string;
  entregaId: string;
  texto?: string;
  variante?: "primario" | "secundario";
  conectarHref: string;
  perguntar?: string;
}) {
  const router = useRouter();
  const { pedir, janela } = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <div className="flex flex-col gap-2">
      <Botao
        type="button"
        variante={variante}
        disabled={pendente}
        className="w-full"
        onClick={async () => {
          if (!(await pedir({ titulo: perguntar ?? "Enviar a devolutiva por e-mail?", texto: "Sai do seu Gmail para os e-mails cadastrados.", sim: "Sim, enviar" }))) return;
          iniciar(async () => {
            setMsg(null);
            const r = await enviarDevolutivaPorEmail(slug, entregaId);
            setMsg(r.ok ? null : r);
            router.refresh();
          });
        }}
      >
        {pendente ? "Enviando…" : texto}
      </Botao>
      {janela}
      <AvisoEnvio msg={msg} conectarHref={conectarHref} />
    </div>
  );
}

/** Envia várias devolutivas aprovadas, uma de cada vez, mostrando o andamento. */
export function EnviarVarias({
  slug,
  entregas,
  conectarHref,
}: {
  slug: string;
  entregas: { id: string; nome: string }[];
  conectarHref: string;
}) {
  const router = useRouter();
  const [andando, setAndando] = useState(false);
  const [feitas, setFeitas] = useState(0);
  const [erros, setErros] = useState<string[]>([]);
  const [reconectar, setReconectar] = useState(false);
  const { pedir, janela } = useConfirmar();
  if (!entregas.length && !erros.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {entregas.length ? (
        <Botao
          type="button"
          disabled={andando}
          onClick={async () => {
            if (!(await pedir({ titulo: `Enviar ${entregas.length === 1 ? "1 devolutiva aprovada" : `${entregas.length} devolutivas aprovadas`}?`, texto: "Saem do seu Gmail, cada uma para os e-mails da sua equipe.", sim: "Sim, enviar" }))) return;
            setAndando(true);
            setErros([]);
            setFeitas(0);
            setReconectar(false);
            for (const e of entregas) {
              const r = await enviarDevolutivaPorEmail(slug, e.id);
              if (!r.ok) {
                setErros((x) => [...x, `${e.nome}: ${r.mensagem}`]);
                if (r.reconectar) {
                  setReconectar(true);
                  break;
                }
              }
              setFeitas((n) => n + 1);
            }
            setAndando(false);
            router.refresh();
          }}
        >
          {andando ? `Enviando ${Math.min(feitas + 1, entregas.length)} de ${entregas.length}…` : `Enviar as ${entregas.length} aprovadas`}
        </Botao>
      ) : null}
      {janela}
      {erros.length ? (
        <Aviso tipo="erro">
          <ul className="list-disc pl-4">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {reconectar ? (
            <a href={conectarHref} className="font-semibold underline">
              Conectar meu Gmail
            </a>
          ) : null}
        </Aviso>
      ) : null}
    </div>
  );
}

/**
 * Devolver na tarefa do Moodle (comentário e, se quiser, a nota), por
 * e-mail, ou nos dois. Para entregas de tarefas que vieram do Moodle.
 */
export function DevolverMoodle({
  slug,
  entregaId,
  moodle,
  emailPronto,
  conectarHref,
}: {
  slug: string;
  entregaId: string;
  moodle: InfoMoodle;
  /** Gmail conectado e alguém com e-mail para receber. */
  emailPronto: boolean;
  conectarHref: string;
}) {
  const router = useRouter();
  const [via, setVia] = useState<"moodle" | "email" | "os2">("moodle");
  const [comNota, setComNota] = useState(Boolean(moodle.notaPrevista));
  const [pendente, iniciar] = useTransition();
  const [msgs, setMsgs] = useState<NonNullable<Msg>[]>([]);
  const { pedir, janela } = useConfirmar();
  const opcoes = [
    { id: "moodle", nome: "No Moodle", detalhe: "Aparece como comentário na tarefa. O Moodle avisa quem entregou.", pode: true },
    { id: "email", nome: "Por e-mail", detalhe: emailPronto ? "Sai do seu Gmail, como nas outras entregas." : "Conecte seu Gmail (e cadastre os e-mails) para usar.", pode: emailPronto },
    { id: "os2", nome: "Nos dois", detalhe: "Comentário no Moodle e e-mail.", pode: emailPronto },
  ] as const;
  const usaMoodle = via !== "email";

  return (
    <div className="flex flex-col gap-2.5">
      {moodle.enviada ? (
        <p className="font-semibold text-marca-forte">
          Devolvida no Moodle em {moodle.em}
          {moodle.nota !== null ? ` · nota ${moodle.nota}` : ""}
        </p>
      ) : null}
      {moodle.erro ? <Aviso tipo="erro">A última devolução no Moodle falhou: {moodle.erro}</Aviso> : null}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[13px] font-semibold">Como devolver</legend>
        {opcoes.map((o) => (
          <label
            key={o.id}
            className={`flex items-start gap-2.5 rounded-xl px-3 py-2 ${via === o.id ? "bg-marca-clara" : ""} ${o.pode ? "cursor-pointer" : "opacity-60"}`}
          >
            <input
              type="radio"
              name={`via-${entregaId}`}
              checked={via === o.id}
              disabled={!o.pode || pendente}
              onChange={() => setVia(o.id)}
              className="mt-0.5 size-5 shrink-0 accent-[var(--marca)]"
            />
            <span className="flex flex-col">
              <span className="font-semibold">{o.nome}</span>
              <span className="text-xs text-suave">{o.detalhe}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {usaMoodle && moodle.notaPrevista ? (
        <label className="flex min-h-11 items-center gap-2.5 border-t border-borda px-1 pt-2">
          <input type="checkbox" checked={comNota} disabled={pendente} onChange={(e) => setComNota(e.target.checked)} className="size-5 shrink-0 accent-[var(--marca)]" />
          <span className="flex flex-col">
            <span className="font-semibold">Lançar a nota no Moodle: {moodle.notaPrevista}</span>
            <span className="text-xs text-suave">Sem marcar, a nota que já está no Moodle fica como está.</span>
          </span>
        </label>
      ) : null}
      {!emailPronto && !moodle.enviada ? (
        <a href={conectarHref} className="text-xs font-medium text-marca-forte underline">
          Conectar meu Gmail para também mandar por e-mail
        </a>
      ) : null}
      <Botao
        type="button"
        disabled={pendente}
        variante={moodle.enviada ? "secundario" : "primario"}
        onClick={async () => {
          const titulo = moodle.enviada
            ? "Devolver de novo?"
            : via === "moodle"
              ? "Devolver no Moodle?"
              : via === "email"
                ? "Enviar por e-mail?"
                : "Devolver no Moodle e por e-mail?";
          const texto = [
            moodle.enviada ? "O comentário no Moodle será trocado por este." : "",
            via !== "email" && comNota && moodle.notaPrevista ? `A nota ${moodle.notaPrevista} vai para o Moodle.` : "",
            via !== "moodle" ? "O e-mail sai do seu Gmail." : "",
          ]
            .filter(Boolean)
            .join(" ");
          if (!(await pedir({ titulo, texto: texto || undefined, sim: "Sim, devolver" }))) return;
          iniciar(async () => {
            const feitas: NonNullable<Msg>[] = [];
            if (via !== "email") feitas.push(await devolverNoMoodleAcao(slug, entregaId, comNota));
            if (via !== "moodle") {
              const r = await enviarDevolutivaPorEmail(slug, entregaId);
              feitas.push(r.ok ? { ...r, mensagem: `E-mail: ${r.mensagem}` } : r);
            }
            setMsgs(feitas);
            router.refresh();
          });
        }}
      >
        {pendente ? "Devolvendo…" : moodle.enviada ? "Devolver de novo" : "Devolver"}
      </Botao>
      {janela}
      {msgs.map((m, i) => (
        <AvisoEnvio key={i} msg={m} conectarHref={conectarHref} />
      ))}
    </div>
  );
}

export type InfoMoodle = { enviada: boolean; em: string; nota: string | null; erro: string; notaPrevista: string | null };

export type InfoClassroom = { nosso: boolean; enviada: boolean; em: string; nota: string | null; erro: string; notaPrevista: string | null; link: string };

/**
 * Lança no Classroom a nota da devolutiva aprovada e devolve o trabalho ao
 * aluno. O Google só deixa isso em tarefa criada pelo Handback; a
 * devolutiva escrita vai por e-mail (o Classroom não aceita comentário de apps).
 */
export function DevolverClassroom({ slug, entregaId, classroom }: { slug: string; entregaId: string; classroom: InfoClassroom }) {
  const router = useRouter();
  const { pedir, janela } = useConfirmar();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <div className="flex flex-col gap-2 border-t border-borda pt-2">
      <strong className="text-[13px]">Google Classroom</strong>
      {classroom.enviada ? (
        <p className="font-semibold text-marca-forte">
          Nota {classroom.nota} lançada no Classroom em {classroom.em}
        </p>
      ) : null}
      {classroom.erro ? <Aviso tipo="erro">A última tentativa no Classroom falhou: {classroom.erro}</Aviso> : null}
      {!classroom.nosso ? (
        <p className="text-xs text-suave">
          Esta tarefa foi criada direto no Classroom, e o Google não deixa o Handback lançar nota nela.
          {classroom.notaPrevista ? ` Lance lá: ${classroom.notaPrevista}.` : ""}{" "}
          {classroom.link ? (
            <a href={classroom.link} target="_blank" rel="noopener noreferrer" className="font-medium text-marca-forte underline">
              Abrir no Classroom
            </a>
          ) : null}
        </p>
      ) : !classroom.notaPrevista ? (
        <p className="text-xs text-suave">Este conceito ainda não tem nota. Ajuste as notas em Google Classroom › Nota para cada conceito.</p>
      ) : (
        <Botao
          type="button"
          variante={classroom.enviada ? "secundario" : "primario"}
          disabled={pendente}
          onClick={async () => {
            if (
              !(await pedir({
                titulo: classroom.enviada ? "Lançar a nota de novo?" : "Devolver no Classroom?",
                texto: `A nota ${classroom.notaPrevista} vai para o Classroom agora e o trabalho volta para o aluno, que já consegue ver. A devolutiva escrita vai por e-mail.`,
                sim: "Sim, devolver",
              }))
            )
              return;
            iniciar(async () => {
              setMsg(await devolverNoClassroomAcao(slug, entregaId));
              router.refresh();
            });
          }}
        >
          {pendente ? "Lançando…" : classroom.enviada ? "Lançar de novo no Classroom" : "Devolver no Classroom"}
        </Botao>
      )}
      {msg ? <Aviso tipo={msg.ok ? "info" : "erro"}>{msg.mensagem}</Aviso> : null}
      {janela}
    </div>
  );
}

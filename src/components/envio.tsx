"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enviarDevolutivaPorEmail } from "@/app/app/[slug]/entregas/acoes";
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
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <div className="flex flex-col gap-2">
      <Botao
        type="button"
        variante={variante}
        disabled={pendente}
        className="w-full"
        onClick={() => {
          if (perguntar && !window.confirm(perguntar)) return;
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
  if (!entregas.length && !erros.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {entregas.length ? (
        <Botao
          type="button"
          disabled={andando}
          onClick={async () => {
            if (!window.confirm(`Enviar ${entregas.length} devolutiva(s) aprovada(s) pelo seu Gmail?`)) return;
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

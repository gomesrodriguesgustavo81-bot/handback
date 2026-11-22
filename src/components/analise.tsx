"use client";

import { useActionState, useEffect, useState, useTransition, startTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { analisarComIA, revisarDevolutiva } from "@/app/app/[slug]/entregas/acoes";
import type { Resultado } from "./form-acao";
import { Aviso, Botao } from "./ui";

/** Cronômetro simples enquanto a IA trabalha. */
function useSegundos(ativo: boolean) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const inicio = Date.now();
    const t = setInterval(() => setS(Math.round((Date.now() - inicio) / 1000)), 1000);
    return () => {
      clearInterval(t);
      setS(0);
    };
  }, [ativo]);
  return s;
}

export function BotaoAnalisar({
  slug,
  entregaId,
  texto = "Analisar com IA",
  variante = "primario",
}: {
  slug: string;
  entregaId: string;
  texto?: string;
  variante?: "primario" | "secundario";
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const segundos = useSegundos(pendente);
  return (
    <div className="flex flex-col gap-2">
      <Botao
        type="button"
        variante={variante}
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setMsg(null);
            const r = await analisarComIA(slug, entregaId);
            setMsg(r);
            router.refresh();
          })
        }
      >
        {pendente ? `Analisando… ${segundos}s` : texto}
      </Botao>
      {pendente ? <p className="text-xs text-suave">A IA lê os arquivos e escreve a análise. Costuma levar de 20 segundos a 2 minutos.</p> : null}
      {msg && !msg.ok ? <Aviso tipo="erro">{msg.mensagem}</Aviso> : null}
    </div>
  );
}

/** Analisa várias entregas, uma de cada vez, mostrando o andamento. */
export function AnalisarVarias({ slug, entregas, rotulo }: { slug: string; entregas: { id: string; nome: string }[]; rotulo: string }) {
  const router = useRouter();
  const [andando, setAndando] = useState(false);
  const [feitas, setFeitas] = useState(0);
  const [erros, setErros] = useState<string[]>([]);
  if (!entregas.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <Botao
        type="button"
        variante="secundario"
        disabled={andando}
        onClick={async () => {
          setAndando(true);
          setErros([]);
          setFeitas(0);
          for (const e of entregas) {
            const r = await analisarComIA(slug, e.id);
            if (!r.ok) setErros((x) => [...x, `${e.nome}: ${r.mensagem}`]);
            setFeitas((n) => n + 1);
            router.refresh();
          }
          setAndando(false);
        }}
      >
        {andando ? `Analisando ${Math.min(feitas + 1, entregas.length)} de ${entregas.length}…` : rotulo}
      </Botao>
      {erros.length ? (
        <Aviso tipo="erro">
          <ul className="list-disc pl-4">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Aviso>
      ) : null}
    </div>
  );
}

const OPCOES_CONCEITO = ["EXCELENTE", "BOM", "REGULAR", "RUIM", "PENDENTE"];

/** Revisão da devolutiva: conceito + texto, com "Salvar rascunho" e "Aprovar". */
export function FormRevisao({
  slug,
  entregaId,
  conceito,
  devolutiva,
  conceitoIa,
  extra,
}: {
  slug: string;
  entregaId: string;
  conceito: string;
  devolutiva: string;
  conceitoIa: string | null;
  extra?: ReactNode;
}) {
  const [estado, enviar, enviando] = useActionState<Resultado, FormData>(revisarDevolutiva.bind(null, slug, entregaId), null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const submissor = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const dados = new FormData(e.currentTarget, submissor);
        startTransition(() => enviar(dados));
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Conceito</span>
        <select
          name="conceito"
          defaultValue={conceito}
          className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
        >
          {OPCOES_CONCEITO.map((c) => (
            <option key={c} value={c}>
              {c}
              {c === conceitoIa ? " (sugerido pela IA)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Devolutiva para o grupo</span>
        <textarea
          name="devolutiva"
          rows={8}
          defaultValue={devolutiva}
          maxLength={10000}
          className="w-full rounded-xl border border-borda bg-cartao px-3 py-2 text-base leading-relaxed text-texto"
        />
        <span className="text-xs text-suave">Edite à vontade. Nada é enviado sem aprovação.</span>
      </label>
      {extra}
      {estado ? <Aviso tipo={estado.ok ? "info" : "erro"}>{estado.mensagem}</Aviso> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Botao type="submit" name="acao" value="salvar" variante="secundario" disabled={enviando}>
          Salvar rascunho
        </Botao>
        <Botao type="submit" name="acao" value="aprovar" disabled={enviando}>
          {enviando ? "Salvando…" : "Aprovar devolutiva"}
        </Botao>
      </div>
    </form>
  );
}

export function BotaoCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Botao
      type="button"
      variante="secundario"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2500);
        } catch {
          setCopiado(false);
        }
      }}
    >
      {copiado ? "Copiado ✓" : "Copiar devolutiva"}
    </Botao>
  );
}

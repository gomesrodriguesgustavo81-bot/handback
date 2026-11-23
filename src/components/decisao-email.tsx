"use client";
import { useConfirmar } from "./confirmar";

import { startTransition, useActionState } from "react";
import { decidirEmail } from "@/app/app/[slug]/entregas/acoes";
import type { Resultado } from "./form-acao";
import { Aviso, Botao } from "./ui";

type Opcao = { id: string; nome: string };

/** Decisão sobre um e-mail da caixa: escolher etapa e grupo e tocar “É entrega”, ou “Ignorar”. */
export function DecisaoEmail({
  slug,
  emailId,
  etapas,
  grupos,
  etapaSugerida,
  grupoSugerido,
  rotuloEtapa,
  rotuloGrupo,
  podeIgnorar,
  gmail = false,
  linkGmail = null,
}: {
  slug: string;
  emailId: string;
  etapas: Opcao[];
  grupos: Opcao[];
  etapaSugerida: string | null;
  grupoSugerido: string | null;
  rotuloEtapa: string;
  rotuloGrupo: string;
  podeIgnorar: boolean;
  /** Pedido de confirmação de encaminhamento do Gmail: só “Abrir o link” e “Já confirmei”. */
  gmail?: boolean;
  linkGmail?: string | null;
}) {
  const [estado, enviar, enviando] = useActionState<Resultado, FormData>(decidirEmail.bind(null, slug, emailId), null);
  const { pedir, janela } = useConfirmar();
  if (gmail) {
    return (
      <form
        className={`grid gap-2 ${linkGmail ? "grid-cols-2" : "grid-cols-1"}`}
        onSubmit={(e) => {
          e.preventDefault();
          const dados = new FormData();
          dados.set("acao", "ignorar");
          startTransition(() => enviar(dados));
        }}
      >
        {linkGmail ? (
          <a
            href={linkGmail}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-borda bg-cartao px-4 font-medium text-texto hover:bg-fundo"
          >
            Abrir o link
          </a>
        ) : null}
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : "Já confirmei no Gmail"}
        </Botao>
      </form>
    );
  }
  const caixa = "min-h-11 w-full rounded-[10px] border border-borda bg-cartao px-2 text-base text-texto";
  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const submissor = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const ignorar = submissor?.value === "ignorar";
        const ok = await pedir(
          ignorar
            ? { titulo: "Ignorar este e-mail?", texto: "Ele não é uma entrega e sai da caixa.", sim: "Sim, ignorar", perigo: true }
            : { titulo: "Registrar como entrega?", texto: "O e-mail vira a entrega da equipe escolhida.", sim: "Sim, registrar" },
        );
        if (!ok) return;
        const dados = new FormData(form, submissor);
        startTransition(() => enviar(dados));
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-suave">
          {rotuloGrupo}
          <select name="grupo" aria-label={rotuloGrupo} required defaultValue={grupoSugerido ?? ""} className={caixa}>
            <option value="" disabled>
              Escolha…
            </option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-suave">
          {rotuloEtapa}
          <select name="etapa" aria-label={rotuloEtapa} required defaultValue={etapaSugerida ?? ""} className={caixa}>
            <option value="" disabled>
              Escolha…
            </option>
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      {estado && !estado.ok ? <Aviso tipo="erro">{estado.mensagem}</Aviso> : null}
      <div className={`grid gap-2 ${podeIgnorar ? "grid-cols-2" : "grid-cols-1"}`}>
        {podeIgnorar ? (
          <Botao type="submit" name="acao" value="ignorar" variante="secundario" formNoValidate disabled={enviando}>
            Ignorar
          </Botao>
        ) : null}
        <Botao type="submit" name="acao" value="entrega" disabled={enviando}>
          {enviando ? "Salvando…" : "É entrega"}
        </Botao>
      </div>
      {janela}
    </form>
  );
}

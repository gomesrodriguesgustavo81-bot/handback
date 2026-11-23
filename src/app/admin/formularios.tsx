"use client";

import { useActionState } from "react";
import { Aviso, Botao } from "@/components/ui";
import { useFormConfirmado } from "@/components/confirmar";
import { entrarEmEmergencia, mudarSituacao, type EstadoForm } from "./actions";

const SITUACOES = [
  { valor: "liberado", nome: "Liberado (sem cobrança)" },
  { valor: "teste", nome: "Em teste" },
  { valor: "ativo", nome: "Ativo (pago)" },
  { valor: "vencido", nome: "Vencido (só leitura)" },
];

/** Situação de cobrança do espaço (por enquanto, todos liberados). */
export function FormSituacao({ id, situacao, testeAte }: { id: string; situacao: string; testeAte: string | null }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(mudarSituacao.bind(null, id), null);
  const { onSubmit, janela } = useFormConfirmado({ titulo: "Mudar a situação deste espaço?", sim: "Sim, mudar" });
  return (
    <form action={acao} onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      {janela}
      <label className="flex min-w-40 flex-1 flex-col gap-1">
        <span className="text-xs font-medium text-suave">Situação</span>
        <select name="situacao" defaultValue={situacao} className="min-h-11 rounded-xl border border-borda bg-cartao px-3 text-sm">
          {SITUACOES.map((s) => (
            <option key={s.valor} value={s.valor}>
              {s.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-suave">Teste até</span>
        <input type="date" name="teste_ate" defaultValue={testeAte ?? ""} className="min-h-11 rounded-xl border border-borda bg-cartao px-3 text-sm" />
      </label>
      <Botao type="submit" variante="secundario" disabled={enviando}>
        {enviando ? "Salvando…" : "Salvar"}
      </Botao>
      {estado ? (
        <div className="w-full">
          <Aviso tipo={estado.ok ? "info" : "erro"}>{estado.mensagem}</Aviso>
        </div>
      ) : null}
    </form>
  );
}

/** Acesso de emergência: motivo obrigatório; o cliente é avisado por e-mail. */
export function FormEmergencia({ id, slug, nome }: { id: string; slug: string; nome: string }) {
  const [estado, acao, enviando] = useActionState<EstadoForm, FormData>(entrarEmEmergencia.bind(null, id, slug), null);
  const { onSubmit, janela } = useFormConfirmado({ titulo: `Entrar em ${nome} por emergência?`, texto: "Vale 4 horas. Quem administra recebe um e-mail com o motivo.", sim: "Sim, entrar", perigo: true });
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-erro">Acesso de emergência</summary>
      <form action={acao} onSubmit={onSubmit} className="mt-2 flex flex-col gap-2 rounded-xl border border-erro/30 bg-erro-fundo p-3">
        {janela}
        <p className="text-texto">
          Só para casos graves (abuso, ordem da Justiça, problema sério sem resposta do cliente). Vale por 4 horas. Quem administra{" "}
          <strong>{nome}</strong> recebe um e-mail na hora com o motivo, e tudo fica no registro do espaço.
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Motivo (o cliente vai ler)</span>
          <textarea name="motivo" rows={2} required minLength={10} maxLength={500} className="rounded-xl border border-borda bg-cartao px-3 py-2 text-base" />
        </label>
        {estado ? <Aviso tipo={estado.ok ? "info" : "erro"}>{estado.mensagem}</Aviso> : null}
        <button type="submit" disabled={enviando} className="min-h-11 self-start rounded-xl bg-erro px-4 font-medium text-white disabled:opacity-60">
          {enviando ? "Avisando o cliente…" : "Entrar em emergência e avisar o cliente"}
        </button>
      </form>
    </details>
  );
}

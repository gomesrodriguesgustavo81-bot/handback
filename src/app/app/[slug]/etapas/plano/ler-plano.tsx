"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirmar } from "@/components/confirmar";
import { Aviso, Botao } from "@/components/ui";
import type { CicloDoPlano } from "@/lib/ia/plano";
import { criarCiclosDoPlano, lerPlano } from "../acoes";

type Linha = CicloDoPlano & { incluir: boolean; chave: number };

const campo = "min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto";

/** Passo 1: colar ou enviar o plano. Passo 2: revisar o que a IA achou e criar. */
export function LerPlano({ slug, palavraEtapa, palavraEtapas }: { slug: string; palavraEtapa: string; palavraEtapas: string }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  const [erro, setErro] = useState("");
  const [lendo, ler] = useTransition();
  const [criando, criar] = useTransition();
  const { pedir, janela } = useConfirmar();
  const router = useRouter();
  const mudar = (chave: number, parte: Partial<Linha>) => setLinhas((l) => (l ?? []).map((x) => (x.chave === chave ? { ...x, ...parte } : x)));
  const escolhidas = (linhas ?? []).filter((l) => l.incluir);

  if (!linhas) {
    return (
      <form
        className="flex flex-col gap-4 rounded-2xl border border-borda bg-cartao p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const dados = new FormData(e.currentTarget);
          setErro("");
          ler(async () => {
            const r = await lerPlano(slug, dados);
            if (r.ok && r.ciclos) setLinhas(r.ciclos.map((c, i) => ({ ...c, incluir: true, chave: i })));
            else setErro(r.mensagem);
          });
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Texto do plano de ensino</span>
          <textarea
            name="texto"
            rows={8}
            placeholder="Cole aqui o cronograma ou o plano inteiro…"
            className="w-full rounded-xl border border-borda bg-cartao px-3 py-2 text-base text-texto placeholder:text-suave"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Ou envie o arquivo (PDF, Word ou foto, até 4 MB)</span>
          <input type="file" name="arquivo" accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,image/*,application/pdf" className="text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border file:border-borda file:bg-fundo file:px-3 file:font-semibold" />
        </label>
        {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
        <Botao type="submit" disabled={lendo}>
          {lendo ? "A IA está lendo o plano… (até 1 minuto)" : "Ler com a IA"}
        </Botao>
        <p className="text-xs text-suave">Nada é criado ainda: no próximo passo você revisa e escolhe o que entra.</p>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Aviso tipo="info">
        A IA achou {linhas.length} {linhas.length === 1 ? "entrega" : "entregas"}. Confira os títulos, os prazos e o que entregar. Desmarque o que não quiser.
      </Aviso>
      <ol className="flex flex-col gap-3">
        {linhas.map((l) => (
          <li key={l.chave} className={`flex flex-col gap-3 rounded-2xl border bg-cartao p-4 ${l.incluir ? "border-borda" : "border-dashed border-borda opacity-60"}`}>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={l.incluir} onChange={(e) => mudar(l.chave, { incluir: e.target.checked })} className="size-5 accent-[var(--marca)]" aria-label={`Incluir ${palavraEtapa} ${l.numero}`} />
              <span className="font-semibold">
                {palavraEtapa} {l.numero}
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-suave">Título</span>
              <input value={l.titulo} onChange={(e) => mudar(l.chave, { titulo: e.target.value })} aria-label={`Título d${palavraEtapa} ${l.numero}`} className={`${campo} font-semibold`} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-suave">Abre em (opcional)</span>
                <input type="date" value={l.recebe_de} onChange={(e) => mudar(l.chave, { recebe_de: e.target.value })} className={campo} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-suave">Prazo</span>
                <input type="date" value={l.recebe_ate} onChange={(e) => mudar(l.chave, { recebe_ate: e.target.value })} aria-label={`Prazo d${palavraEtapa} ${l.numero}`} className={campo} />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-suave">O que entregar (um por linha)</span>
              <textarea
                rows={Math.max(2, l.entregaveis.length)}
                value={l.entregaveis.join("\n")}
                onChange={(e) => mudar(l.chave, { entregaveis: e.target.value.split("\n") })}
                className="w-full rounded-xl border border-borda bg-cartao px-3 py-2 text-base text-texto"
              />
            </label>
            {l.criterios ? <p className="text-xs text-suave">Critérios: {l.criterios}</p> : null}
          </li>
        ))}
      </ol>
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <div className="sticky bottom-24 z-20 flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-3 shadow-lg sm:flex-row lg:bottom-4">
        <Botao type="button" variante="secundario" onClick={() => setLinhas(null)} disabled={criando}>
          Voltar
        </Botao>
        <Botao
          type="button"
          className="flex-1"
          disabled={criando || !escolhidas.length}
          onClick={async () => {
            if (!(await pedir({ titulo: `Criar ${escolhidas.length} ${escolhidas.length === 1 ? palavraEtapa.toLowerCase() : palavraEtapas.toLowerCase()}?`, texto: "Dá para editar ou apagar cada um depois.", sim: "Sim, criar" }))) return;
            setErro("");
            criar(async () => {
              const r = await criarCiclosDoPlano(
                slug,
                escolhidas.map(({ incluir: _i, chave: _c, ...c }) => ({ ...c, entregaveis: c.entregaveis.map((s) => s.trim()).filter(Boolean) })),
              );
              if (r.ok) router.push(`/app/${slug}/etapas?criados=${escolhidas.length}`);
              else setErro(r.mensagem);
            });
          }}
        >
          {criando ? "Criando…" : `Criar ${escolhidas.length} ${escolhidas.length === 1 ? palavraEtapa.toLowerCase() : palavraEtapas.toLowerCase()}`}
        </Botao>
      </div>
      {janela}
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { mediaPorAnalise, nomeDoMes, resumirGasto, type LinhaUso } from "@/lib/gasto-ia";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmasDaEmpresa } from "@/lib/turma";

export const metadata: Metadata = { title: "Gasto da IA" };

const n = (v: number) => new Intl.NumberFormat("pt-BR").format(v);

type Linha = { criado_em: string; tokens_entrada: number; tokens_saida: number; entregas: { etapas: { turma_id: string | null } | null } | null };

/** Quanto a IA gastou (em tokens) por mês e por turma. Só quem administra a conta vê. */
export default async function GastoDaIA({ params }: PageProps<"/app/[slug]/configuracoes/gasto-ia">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const supabase = await criarClienteServidor();
  const [{ data }, turmas] = await Promise.all([
    supabase
      .from("uso_ia")
      .select("criado_em, tokens_entrada, tokens_saida, entregas(etapas(turma_id))")
      .eq("org_id", empresa.id)
      .order("criado_em", { ascending: false })
      .limit(20000),
    turmasDaEmpresa(empresa.id),
  ]);
  const linhas: LinhaUso[] = ((data ?? []) as unknown as Linha[]).map((l) => ({
    criado_em: l.criado_em,
    tokens_entrada: l.tokens_entrada,
    tokens_saida: l.tokens_saida,
    turma_id: l.entregas?.etapas?.turma_id ?? null,
  }));
  const r = resumirGasto(linhas, new Date().toISOString());
  const media = mediaPorAnalise(r.mesAtual);
  const nomeDe = new Map(turmas.map((t) => [t.id, t.nome]));

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Gasto da IA</h1>
        <p className="text-sm text-suave">
          Quantos tokens (a medida que o Google cobra) as análises usaram. Só números: nunca o texto dos alunos. Cada análise e cada reanálise contam.
        </p>
      </div>

      {!r.total.analises ? (
        <p className="rounded-2xl border border-dashed border-borda p-4 text-sm text-suave">Ainda não há análises registradas. O registro começou a valer em novembro de 2026; análises mais antigas não aparecem.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <Numero rotulo="Análises neste mês" valor={n(r.mesAtual.analises)} />
            <Numero rotulo="Média por análise" valor={`${n(media.entrada + media.saida)} tokens`} extra={`${n(media.entrada)} entrada · ${n(media.saida)} saída`} />
            <Numero rotulo="Tokens de entrada (mês)" valor={n(r.mesAtual.entrada)} />
            <Numero rotulo="Tokens de saída (mês)" valor={n(r.mesAtual.saida)} />
          </dl>

          <section aria-label="Por mês" className="flex flex-col gap-1.5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-suave">Por mês</h2>
            <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-cartao">
              {r.porMes.map((m) => (
                <li key={m.mes} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-semibold">{nomeDoMes(m.mes)}</span>
                  <span className="text-right text-suave">
                    {n(m.analises)} {m.analises === 1 ? "análise" : "análises"} · {n(m.entrada)} entrada · {n(m.saida)} saída
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Por turma" className="flex flex-col gap-1.5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-suave">Por turma (desde o começo do registro)</h2>
            <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-cartao">
              {r.porTurma.map((t) => (
                <li key={t.turmaId ?? "sem"} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0 break-words font-semibold">{t.turmaId ? (nomeDe.get(t.turmaId) ?? "Turma apagada") : "Sem turma"}</span>
                  <span className="shrink-0 text-right text-suave">
                    {n(t.analises)} · {n(t.entrada + t.saida)} tokens
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <p className="text-xs leading-relaxed text-suave">
            Para saber o custo em reais, multiplique os tokens de entrada e de saída pelos preços atuais do modelo no Google (eles mudam, por isso não
            mostramos o valor aqui). Os tokens de saída incluem o “raciocínio” do modelo, que também é cobrado.
          </p>
        </>
      )}
    </div>
  );
}

function Numero({ rotulo, valor, extra }: { rotulo: string; valor: string; extra?: string }) {
  return (
    <div className="flex flex-col-reverse gap-0.5 rounded-2xl border border-borda bg-cartao px-3 py-2.5">
      <dt className="text-xs text-suave">{rotulo}</dt>
      <dd className="text-xl font-extrabold">
        {valor}
        {extra ? <span className="mt-0.5 block text-[11px] font-medium text-suave">{extra}</span> : null}
      </dd>
    </div>
  );
}

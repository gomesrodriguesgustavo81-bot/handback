import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SeloConceito } from "@/components/conceito";
import { Cartao, Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { ORDEM_CONCEITOS, resumirConcordancia, tendencia } from "@/lib/ia/calibracao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";

export const metadata: Metadata = { title: "Como a IA está indo" };

type Linha = {
  conceito_ia: string | null;
  conceito: string | null;
  motivo_mudanca: string;
  atualizada_em: string;
  entregas: { etapa_id: string; etapas: { numero: number; titulo: string } | null; grupos: { nome: string } | null } | null;
};

export default async function Calibracao({ params }: PageProps<"/app/[slug]/entregas/calibracao">) {
  const { slug } = await params;
  const { empresa, podeAvaliar, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) notFound();
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("analises")
    .select("conceito_ia, conceito, motivo_mudanca, atualizada_em, entregas(etapa_id, etapas(numero, titulo), grupos(nome))")
    .eq("org_id", empresa.id)
    .eq("status", "aprovada")
    .order("atualizada_em", { ascending: false })
    .limit(2000);
  const linhas = (data ?? []) as unknown as Linha[];
  const geral = resumirConcordancia(linhas.map((l) => ({ ia: l.conceito_ia, final: l.conceito })));
  const frase = tendencia(geral);
  const pct = geral.total ? Math.round((geral.iguais / geral.total) * 100) : 0;

  const porEtapa = new Map<string, { nome: string; numero: number; pares: { ia: string | null; final: string | null }[] }>();
  for (const l of linhas) {
    const e = l.entregas;
    if (!e?.etapas) continue;
    const item = porEtapa.get(e.etapa_id) ?? { nome: e.etapas.titulo, numero: e.etapas.numero, pares: [] };
    item.pares.push({ ia: l.conceito_ia, final: l.conceito });
    porEtapa.set(e.etapa_id, item);
  }
  const etapas = [...porEtapa.values()].sort((a, b) => a.numero - b.numero).map((x) => ({ ...x, r: resumirConcordancia(x.pares) }));
  const mudancas = linhas.filter((l) => l.conceito_ia && l.conceito && l.conceito_ia !== l.conceito && l.conceito !== "PENDENTE").slice(0, 30);

  return (
    <section className="flex flex-col gap-4">
      <Link href={`/app/${slug}/entregas`} className="text-sm font-semibold text-marca-forte hover:underline">
        ← Painel
      </Link>
      <div>
        <h2 className="text-lg font-semibold">Como a IA está indo</h2>
        <p className="text-sm text-suave">Compara o conceito que a IA sugeriu com o que foi aprovado. Conta só as devolutivas aprovadas.</p>
      </div>

      {geral.total < 3 ? (
        <Vazio>Aprove pelo menos 3 devolutivas analisadas pela IA para ver como ela está indo.</Vazio>
      ) : (
        <>
          <Cartao className="flex flex-col gap-2">
            <p className="text-3xl font-bold">
              {geral.iguais} de {geral.total} <span className="text-lg font-semibold text-suave">({pct}%)</span>
            </p>
            <p className="text-sm">vezes a IA sugeriu o mesmo conceito que foi aprovado.</p>
            {frase ? <p className="text-sm font-medium text-marca-forte">{frase}</p> : null}
            <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-fundo p-2">
                <dt className="text-xs text-suave">IA mais alta</dt>
                <dd className="text-lg font-bold">{geral.iaMaisAlta}</dd>
              </div>
              <div className="rounded-xl bg-fundo p-2">
                <dt className="text-xs text-suave">IA mais baixa</dt>
                <dd className="text-lg font-bold">{geral.iaMaisBaixa}</dd>
              </div>
              <div className="rounded-xl bg-fundo p-2">
                <dt className="text-xs text-suave">Longe (2+ conceitos)</dt>
                <dd className="text-lg font-bold">{geral.distantes}</dd>
              </div>
            </dl>
          </Cartao>

          <Cartao className="flex flex-col gap-3">
            <h3 className="font-semibold">IA × conceito aprovado</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] border-collapse text-center text-sm">
                <caption className="sr-only">Linhas: conceito sugerido pela IA. Colunas: conceito aprovado.</caption>
                <thead>
                  <tr>
                    <th scope="col" className="p-1.5 text-left text-xs font-medium text-suave">
                      IA ↓ · Aprovado →
                    </th>
                    {ORDEM_CONCEITOS.map((c) => (
                      <th key={c} scope="col" className="p-1.5 text-xs font-semibold">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ORDEM_CONCEITOS.map((ia) => (
                    <tr key={ia} className="border-t border-borda">
                      <th scope="row" className="p-1.5 text-left text-xs font-semibold">
                        {ia}
                      </th>
                      {ORDEM_CONCEITOS.map((f) => {
                        const n = geral.matriz[ia][f];
                        return (
                          <td key={f} className={`p-1.5 ${ia === f ? "bg-marca-clara font-bold text-marca-forte" : n ? "bg-alerta-fundo font-semibold text-alerta" : "text-suave"}`}>
                            {n}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-suave">Na diagonal verde, a IA acertou. Fora dela, o que foi mudado.</p>
          </Cartao>

          {etapas.length > 1 ? (
            <Cartao className="flex flex-col gap-2">
              <h3 className="font-semibold">Por {v.etapa.toLowerCase()}</h3>
              <ul className="flex flex-col divide-y divide-borda text-sm">
                {etapas.map((x) => (
                  <li key={x.numero} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 break-words">
                      {v.etapa} {x.numero} · {x.nome}
                    </span>
                    <span className="shrink-0 font-semibold">
                      {x.r.iguais}/{x.r.total}
                    </span>
                  </li>
                ))}
              </ul>
            </Cartao>
          ) : null}
        </>
      )}

      <Cartao className="flex flex-col gap-3">
        <h3 className="font-semibold">Quando o conceito foi mudado</h3>
        {mudancas.length ? (
          <ul className="flex flex-col divide-y divide-borda text-sm">
            {mudancas.map((l, i) => (
              <li key={i} className="flex flex-col gap-1 py-2.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{l.entregas?.grupos?.nome ?? "?"}</span>
                  <span className="text-suave">
                    · {v.etapa} {l.entregas?.etapas?.numero}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    <SeloConceito conceito={l.conceito_ia} /> → <SeloConceito conceito={l.conceito} />
                  </span>
                </span>
                <span className={l.motivo_mudanca ? "" : "italic text-suave"}>{l.motivo_mudanca || "Sem motivo informado"}</span>
                <span className="text-xs text-suave">{dataHoraBR(l.atualizada_em)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-suave">Nenhuma mudança ainda.</p>
        )}
        <p className="text-xs text-suave">Os motivos informados entram nas próximas análises: a IA aprende o critério de vocês.</p>
      </Cartao>

      <Cartao className="flex flex-col gap-2 text-sm">
        <h3 className="font-semibold">Para a IA acertar mais</h3>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Ao mudar um conceito, escreva o motivo em uma linha.</li>
          <li>
            Em cada {v.etapa.toLowerCase()}, use as <strong>observações para a IA</strong> para regras específicas (ex.: “sem dados reais, no
            máximo REGULAR”).
          </li>
          <li>
            {podeGerir ? (
              <>
                Em{" "}
                <Link href={`/app/${slug}/configuracoes/avaliacao`} className="font-medium text-marca-forte underline">
                  Ajustes
                </Link>
                , revise a definição de cada conceito e a regra do checklist.
              </>
            ) : (
              "Peça ao administrador para revisar a definição de cada conceito em Ajustes."
            )}
          </li>
        </ul>
      </Cartao>
    </section>
  );
}

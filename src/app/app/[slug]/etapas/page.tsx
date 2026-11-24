import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { turmaAtual } from "@/lib/turma";
import Link from "next/link";
import { LinkBotao, Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataBR, minusc } from "@/lib/textos";

export async function generateMetadata({ params }: PageProps<"/app/[slug]/etapas">): Promise<Metadata> {
  const { slug } = await params;
  const { empresa } = await contextoDaEmpresa(slug);
  return { title: `${empresa.vocabulario.etapas} · ${empresa.nome}` };
}

export default async function ListaEtapas({ params, searchParams }: PageProps<"/app/[slug]/etapas">) {
  const { slug } = await params;
  const { ver, criados } = await searchParams;
  // O calendário agora é uma aba só, com todas as turmas.
  if (ver === "calendario") redirect(`/app/${slug}/calendario`);
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();
  const turma = await turmaAtual(empresa.id);
  const { data: etapas } = await supabase
    .from("etapas")
    .select("id, numero, titulo, data, recebe_de, recebe_ate, entregaveis")
    .eq("org_id", empresa.id)
    .eq("turma_id", turma?.id ?? "")
    .order("numero");
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{v.etapas}</h2>
        {podeGerir ? (
          <div className="flex flex-wrap gap-2">
            <LinkBotao href={`/app/${slug}/etapas/plano`} variante="secundario">
              Criar a partir do plano de ensino
            </LinkBotao>
            <LinkBotao href={`/app/${slug}/etapas/nova`}>Adicionar {minusc(v.etapa)}</LinkBotao>
          </div>
        ) : null}
      </div>
      {typeof criados === "string" && /^\d+$/.test(criados) ? (
        <p role="status" className="rounded-xl bg-marca-clara px-3 py-2 text-sm font-semibold text-marca-forte">
          {criados} {Number(criados) === 1 ? "criado" : "criados"} a partir do plano de ensino. Confira cada um tocando no nome.
        </p>
      ) : null}

      {etapas?.length ? (
        <Link href={`/app/${slug}/calendario`} className="self-start text-sm font-semibold text-marca-forte hover:underline">
          Ver no calendário (todas as turmas) ›
        </Link>
      ) : null}

      {!etapas?.length ? (
        <Vazio>
          {podeGerir
            ? `Nada cadastrado ainda. Toque em “Adicionar ${minusc(v.etapa)}” para começar.`
            : "Nada cadastrado ainda."}
        </Vazio>
      ) : (
        <ul className="flex flex-col gap-3">
          {etapas.map((e) => (
            <li key={e.id}>
              <Link
                href={`/app/${slug}/etapas/${e.id}`}
                className="flex flex-col gap-1 rounded-2xl border border-borda bg-cartao p-4 hover:border-marca"
              >
                <span className="font-semibold">
                  {v.etapa} {e.numero} · {e.titulo}
                </span>
                <span className="text-sm text-suave">
                  {[
                    e.data ? `Data: ${dataBR(e.data)}` : null,
                    e.recebe_ate
                      ? `Recebe ${e.recebe_de ? `de ${dataBR(e.recebe_de)} ` : ""}até ${dataBR(e.recebe_ate)}`
                      : "Sem prazo definido",
                    `${e.entregaveis.length} ${e.entregaveis.length === 1 ? "item" : "itens"} no checklist`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

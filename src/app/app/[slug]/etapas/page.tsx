import type { Metadata } from "next";
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

export default async function ListaEtapas({ params }: PageProps<"/app/[slug]/etapas">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();
  const { data: etapas } = await supabase
    .from("etapas")
    .select("id, numero, titulo, data, recebe_de, recebe_ate, entregaveis")
    .eq("org_id", empresa.id)
    .order("numero");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{v.etapas}</h2>
        {podeGerir ? <LinkBotao href={`/app/${slug}/etapas/nova`}>Adicionar {minusc(v.etapa)}</LinkBotao> : null}
      </div>

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

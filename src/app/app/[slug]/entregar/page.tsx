import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormEntrega } from "@/components/form-entrega";
import { Cartao, Selo, Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { lerConfigSupabase } from "@/lib/supabase/config";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { etapaDaVez, etapasDaEmpresa, opcoesDeEtapa } from "../entregas/dados";

export const metadata: Metadata = { title: "Entregar" };

export default async function Entregar({ params }: PageProps<"/app/[slug]/entregar">) {
  const { slug } = await params;
  const { empresa, souIntegrante } = await contextoDaEmpresa(slug);
  const grupo = empresa.meuGrupo;
  const config = lerConfigSupabase();
  if (!souIntegrante || !grupo || !config) notFound();
  const v = empresa.vocabulario;

  const supabase = await criarClienteServidor();
  const [etapas, { data: entregas }] = await Promise.all([
    etapasDaEmpresa(empresa.id),
    supabase
      .from("entregas")
      .select("id, etapa_id, enviada_em, atrasada, status")
      .eq("grupo_id", grupo.id)
      .eq("status", "recebida"),
  ]);
  const daEtapa = new Map((entregas ?? []).map((e) => [e.etapa_id, e]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Cartao className="flex flex-col gap-4 self-start">
        <div>
          <h2 className="text-lg font-semibold">Enviar entrega</h2>
          <p className="text-sm text-suave">
            Você entrega por: <strong>{grupo.nome}</strong>. Se enviar de novo, vale a entrega mais recente.
          </p>
        </div>
        {etapas.length ? (
          <FormEntrega
            slug={slug}
            orgId={empresa.id}
            supabaseConfig={config}
            etapas={opcoesDeEtapa(etapas, v)}
            grupos={[grupo]}
            etapaInicial={etapaDaVez(etapas)?.id}
            nomeEtapa={v.etapa}
            nomeGrupo={v.grupo}
          />
        ) : (
          <Vazio>Ainda não há nada para entregar.</Vazio>
        )}
      </Cartao>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Minhas entregas</h2>
        {!etapas.length ? null : (
          <ul className="flex flex-col gap-2">
            {etapas.map((e) => {
              const entrega = daEtapa.get(e.id);
              return (
                <li key={e.id} className="rounded-2xl border border-borda bg-cartao p-4">
                  <p className="font-medium">
                    {v.etapa} {e.numero} · {e.titulo}
                  </p>
                  {entrega ? (
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <Link href={`/app/${slug}/entregas/${entrega.id}`} className="text-marca-forte hover:underline">
                        Entregue em {dataHoraBR(entrega.enviada_em)}
                      </Link>
                      {entrega.atrasada ? <Selo>Com atraso</Selo> : null}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-suave">Ainda não entregue</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

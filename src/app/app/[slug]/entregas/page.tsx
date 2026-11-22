import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormEntrega } from "@/components/form-entrega";
import { Aviso, Cartao, Selo, Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { lerConfigSupabase } from "@/lib/supabase/config";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR, minusc } from "@/lib/textos";
import { etapaDaVez, etapasDaEmpresa, opcoesDeEtapa, situacaoDoPrazo } from "./dados";

export const metadata: Metadata = { title: "Entregas" };

export default async function QuadroEntregas({ params, searchParams }: PageProps<"/app/[slug]/entregas">) {
  const { slug } = await params;
  const { etapa: etapaEscolhida } = await searchParams;
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  const config = lerConfigSupabase();
  if (!podeAvaliar || !config) notFound();
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();

  const [etapas, { count: paraConfirmar }] = await Promise.all([
    etapasDaEmpresa(empresa.id),
    supabase.from("emails_recebidos").select("id", { count: "exact", head: true }).eq("org_id", empresa.id).eq("status", "confirmar"),
  ]);

  const avisoCaixa = paraConfirmar ? (
    <Aviso tipo="alerta">
      <Link href={`/app/${slug}/entregas/caixa`} className="font-medium underline">
        {paraConfirmar} e-mail(s) para confirmar
      </Link>{" "}
      — chegaram fora do padrão e precisam da sua decisão.
    </Aviso>
  ) : null;

  if (!etapas.length) {
    return (
      <div className="flex flex-col gap-4">
        {avisoCaixa}
        <Vazio>
          Primeiro cadastre {minusc(v.etapas)} em{" "}
          <Link href={`/app/${slug}/etapas`} className="text-marca-forte underline">
            {v.etapas}
          </Link>
          .
        </Vazio>
      </div>
    );
  }
  const etapa = etapas.find((e) => e.id === etapaEscolhida) ?? etapaDaVez(etapas)!;

  const [{ data: grupos }, { data: entregas }] = await Promise.all([
    supabase.from("grupos").select("id, nome").eq("org_id", empresa.id).eq("ativo", true).order("nome"),
    supabase
      .from("entregas")
      .select("id, grupo_id, enviada_em, atrasada, status, origem, remetente, arquivos_entrega(id), links")
      .eq("etapa_id", etapa.id)
      .order("enviada_em", { ascending: false }),
  ]);
  const valendo = new Map((entregas ?? []).filter((e) => e.status === "recebida").map((e) => [e.grupo_id, e]));
  const reenvios = new Map<string, number>();
  for (const e of entregas ?? []) if (e.status === "substituida") reenvios.set(e.grupo_id, (reenvios.get(e.grupo_id) ?? 0) + 1);
  const total = grupos?.length ?? 0;
  const entregues = (grupos ?? []).filter((g) => valendo.has(g.id)).length;

  return (
    <div className="flex flex-col gap-6">
      {avisoCaixa}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={`Escolher ${minusc(v.etapa)}`} className="-mx-4 min-w-0 flex-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-2">
            {etapas.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/app/${slug}/entregas?etapa=${e.id}`}
                  aria-current={e.id === etapa.id ? "true" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${
                    e.id === etapa.id ? "border-marca bg-marca-clara font-medium text-marca-forte" : "border-borda bg-cartao"
                  }`}
                >
                  {v.etapa} {e.numero}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link href={`/app/${slug}/entregas/caixa`} className="text-sm font-medium text-marca-forte hover:underline">
          Caixa de e-mails →
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {v.etapa} {etapa.numero} · {etapa.titulo}
            </h2>
            <p className="text-sm text-suave">
              {entregues} de {total} entregaram · {situacaoDoPrazo(etapa)}
            </p>
          </div>
          {!total ? (
            <Vazio>
              Cadastre {minusc(v.grupos)} em{" "}
              <Link href={`/app/${slug}/grupos`} className="text-marca-forte underline">
                {v.grupos}
              </Link>{" "}
              para acompanhar as entregas.
            </Vazio>
          ) : (
            <ul className="flex flex-col gap-2">
              {(grupos ?? []).map((g) => {
                const e = valendo.get(g.id);
                const n = reenvios.get(g.id) ?? 0;
                return (
                  <li key={g.id}>
                    {e ? (
                      <Link
                        href={`/app/${slug}/entregas/${e.id}`}
                        className="flex flex-col gap-1 rounded-2xl border border-borda bg-cartao p-4 hover:border-marca"
                      >
                        <span className="flex flex-wrap items-center gap-2 font-semibold">
                          <span aria-hidden className="text-marca">✓</span> {g.nome}
                          {e.atrasada ? <Selo>Com atraso</Selo> : null}
                          {e.origem === "manual" ? <Selo>Registrada à mão</Selo> : null}
                        </span>
                        <span className="break-words text-sm text-suave">
                          {dataHoraBR(e.enviada_em)}
                          {e.origem === "email" && e.remetente ? ` · ${e.remetente}` : ""} · {e.arquivos_entrega.length} arquivo(s) ·{" "}
                          {e.links.length} link(s)
                          {n ? ` · reenviada ${n}x` : ""}
                        </span>
                      </Link>
                    ) : (
                      <div className="flex flex-col gap-1 rounded-2xl border border-dashed border-borda p-4">
                        <span className="font-semibold">{g.nome}</span>
                        <span className="text-sm text-suave">Pendente</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {total ? (
          <Cartao className="flex flex-col gap-4 self-start">
            <div>
              <h2 className="font-semibold">Registrar entrega à mão</h2>
              <p className="text-sm text-suave">Para quando a entrega chegou por outro meio (em mãos, WhatsApp…).</p>
            </div>
            <FormEntrega
              slug={slug}
              orgId={empresa.id}
              supabaseConfig={config}
              etapas={opcoesDeEtapa(etapas, v)}
              grupos={grupos ?? []}
              etapaInicial={etapa.id}
              nomeEtapa={v.etapa}
              nomeGrupo={v.grupo}
            />
          </Cartao>
        ) : null}
      </div>
    </div>
  );
}

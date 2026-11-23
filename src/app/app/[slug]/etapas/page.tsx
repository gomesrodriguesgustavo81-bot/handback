import type { Metadata } from "next";
import { turmaAtual } from "@/lib/turma";
import Link from "next/link";
import { LinkBotao, Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataBR, hojeISO, minusc } from "@/lib/textos";
import { Calendario } from "./calendario";

export async function generateMetadata({ params }: PageProps<"/app/[slug]/etapas">): Promise<Metadata> {
  const { slug } = await params;
  const { empresa } = await contextoDaEmpresa(slug);
  return { title: `${empresa.vocabulario.etapas} · ${empresa.nome}` };
}

export default async function ListaEtapas({ params, searchParams }: PageProps<"/app/[slug]/etapas">) {
  const { slug } = await params;
  const { ver } = await searchParams;
  const noCalendario = ver === "calendario";
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
  const ids = (etapas ?? []).map((e) => e.id);
  const [{ data: entregas }, { count: grupos }] = noCalendario
    ? await Promise.all([
        ids.length ? supabase.from("entregas").select("etapa_id, grupo_id").in("etapa_id", ids) : Promise.resolve({ data: [] as { etapa_id: string; grupo_id: string }[] }),
        supabase.from("grupos").select("id", { count: "exact", head: true }).eq("turma_id", turma?.id ?? "").eq("ativo", true),
      ])
    : [{ data: null }, { count: 0 }];
  const entregaram = (id: string) => new Set((entregas ?? []).filter((x) => x.etapa_id === id).map((x) => x.grupo_id)).size;
  const base = `/app/${slug}/etapas`;
  const opcao = (ativo: boolean) =>
    `inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors ${ativo ? "bg-cartao text-texto shadow-sm" : "text-suave hover:text-texto"}`;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{v.etapas}</h2>
        {podeGerir ? <LinkBotao href={`/app/${slug}/etapas/nova`}>Adicionar {minusc(v.etapa)}</LinkBotao> : null}
      </div>

      {etapas?.length ? (
        <nav aria-label="Ver como" className="flex self-start rounded-full bg-borda/60 p-1">
          <Link href={base} aria-current={!noCalendario ? "page" : undefined} className={opcao(!noCalendario)} scroll={false}>
            Lista
          </Link>
          <Link href={`${base}?ver=calendario`} aria-current={noCalendario ? "page" : undefined} className={opcao(noCalendario)} scroll={false}>
            Calendário
          </Link>
        </nav>
      ) : null}

      {!etapas?.length ? (
        <Vazio>
          {podeGerir
            ? `Nada cadastrado ainda. Toque em “Adicionar ${minusc(v.etapa)}” para começar.`
            : "Nada cadastrado ainda."}
        </Vazio>
      ) : noCalendario ? (
        <Calendario
          slug={slug}
          hoje={hojeISO()}
          grupos={grupos ?? 0}
          palavraEtapa={v.etapa}
          etapas={etapas.map((e) => ({
            id: e.id,
            rotulo: `${v.etapa} ${e.numero} · ${e.titulo}`,
            recebe_de: e.recebe_de,
            recebe_ate: e.recebe_ate,
            data: e.data,
            entregaram: entregaram(e.id),
          }))}
        />
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

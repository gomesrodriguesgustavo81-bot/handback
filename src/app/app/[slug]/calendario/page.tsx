import type { Metadata } from "next";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario } from "@/lib/nomes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/textos";
import { turmasDaEmpresa } from "@/lib/turma";
import { Vazio } from "@/components/ui";
import { Calendario } from "../etapas/calendario";

export async function generateMetadata({ params }: PageProps<"/app/[slug]/calendario">): Promise<Metadata> {
  const { slug } = await params;
  const { empresa } = await contextoDaEmpresa(slug);
  return { title: `Calendário · ${empresa.nome}` };
}

/** O que abre e o que vence em todas as turmas, num calendário só. */
export default async function CalendarioGeral({ params }: PageProps<"/app/[slug]/calendario">) {
  const { slug } = await params;
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  const v = completarVocabulario(empresa.vocabulario);
  const turmas = (await turmasDaEmpresa(empresa.id)).filter((t) => !t.arquivada);
  const ids = turmas.map((t) => t.id);
  const supabase = await criarClienteServidor();
  const { data: etapas } = ids.length
    ? await supabase.from("etapas").select("id, numero, titulo, data, recebe_de, recebe_ate, turma_id").eq("org_id", empresa.id).in("turma_id", ids).order("numero")
    : { data: [] };
  const idsEtapas = (etapas ?? []).map((e) => e.id);
  const [{ data: entregas }, { data: grupos }] = podeAvaliar && idsEtapas.length
    ? await Promise.all([
        supabase.from("entregas").select("etapa_id, grupo_id").in("etapa_id", idsEtapas).neq("status", "substituida"),
        supabase.from("grupos").select("turma_id").in("turma_id", ids).eq("ativo", true).eq("escondido", false),
      ])
    : [{ data: [] as { etapa_id: string; grupo_id: string }[] }, { data: [] as { turma_id: string }[] }];
  const entregaram = new Map<string, Set<string>>();
  for (const x of entregas ?? []) entregaram.set(x.etapa_id, (entregaram.get(x.etapa_id) ?? new Set()).add(x.grupo_id));
  const porTurma = new Map<string, number>();
  for (const g of grupos ?? []) porTurma.set(g.turma_id, (porTurma.get(g.turma_id) ?? 0) + 1);
  const nomeTurma = new Map(turmas.map((t) => [t.id, t.nome]));

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">Calendário</h2>
        <p className="text-sm text-suave">
          {turmas.length > 1 ? `O que abre e o que vence em todas as ${turmas.length} turmas.` : "O que abre e o que vence na turma."}
        </p>
      </div>
      {!etapas?.length ? (
        <Vazio>Nenhum{v.generos.etapa === "f" ? "a" : ""} {v.etapa.toLowerCase()} com data ainda.</Vazio>
      ) : (
        <Calendario
          slug={slug}
          hoje={hojeISO()}
          palavraEtapa={v.etapa}
          turmas={turmas.map((t) => ({ id: t.id, nome: t.nome }))}
          agenda={podeAvaliar ? `/app/${slug}/configuracoes/agenda` : null}
          etapas={etapas.map((e) => ({
            id: e.id,
            rotulo: `${v.etapa} ${e.numero} · ${e.titulo}`,
            recebe_de: e.recebe_de,
            recebe_ate: e.recebe_ate,
            data: e.data,
            entregaram: entregaram.get(e.id)?.size ?? 0,
            grupos: podeAvaliar ? (porTurma.get(e.turma_id) ?? 0) : 0,
            turma: { id: e.turma_id, nome: nomeTurma.get(e.turma_id) ?? "" },
          }))}
        />
      )}
    </section>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { turmaAtual } from "@/lib/turma";
import Link from "next/link";
import { Vazio } from "@/components/ui";
import { NovoCiclo } from "./novo-ciclo";
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
    .select("id, numero, titulo, data, recebe_de, recebe_ate, entregaveis, classroom_tarefa, classroom_nosso, moodle_tarefa")
    .eq("org_id", empresa.id)
    .eq("turma_id", turma?.id ?? "")
    .order("numero");
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{v.etapas}</h1>
          <p className="text-sm text-suave">As tarefas desta turma. Criar ou trazer, tudo aqui.</p>
        </div>
        {podeGerir ? (
          <NovoCiclo slug={slug} etapa={v.etapa} classroom={Boolean(turma?.classroom_curso)} />
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
            ? `Nada cadastrado ainda. Toque em “+ Nov${/a$/i.test(v.etapa) ? "a" : "o"} ${minusc(v.etapa)}” para começar.`
            : "Nada cadastrado ainda."}
        </Vazio>
      ) : (
        <ul className="flex flex-col gap-3">
          {etapas.map((e) => (
            <li key={e.id}>
              <Link
                href={`/app/${slug}/etapas/${e.id}`}
                transitionTypes={["nav-forward"]}
                className="toque flex flex-col gap-1 rounded-2xl border border-borda bg-cartao p-4 hover:border-marca"
              >
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">
                    {v.etapa} {e.numero} · {e.titulo}
                  </span>
                  {e.classroom_tarefa ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.classroom_nosso ? "bg-ok-fundo text-ok" : "bg-info-fundo text-info"}`}>
                      {e.classroom_nosso ? "Publicado no Classroom" : "Veio do Classroom"}
                    </span>
                  ) : e.moodle_tarefa ? (
                    <span className="rounded-full bg-info-fundo px-2 py-0.5 text-xs font-semibold text-info">Veio do Moodle</span>
                  ) : null}
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

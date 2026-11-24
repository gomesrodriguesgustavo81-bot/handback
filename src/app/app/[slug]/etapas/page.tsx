import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { turmaAtual } from "@/lib/turma";
import Link from "next/link";
import { Vazio } from "@/components/ui";
import { NovoCiclo } from "./novo-ciclo";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataBR, minusc } from "@/lib/textos";
import { trilhasDaTurma } from "@/lib/trilha-dados";
import { rotuloDoPasso, type Trilha } from "@/lib/trilha";
import { resumoDaTurma } from "@/lib/evolucao";
import { hojeISO } from "@/lib/textos";

/** Para onde leva o botão do passo atual de cada ciclo. */
function destinoDoPasso(slug: string, id: string, t: Trilha): { href: string; rotulo: string; forte: boolean } {
  const ciclo = `/app/${slug}/etapas/${id}`;
  switch (t.atual) {
    case 1:
      return { href: ciclo, rotulo: "Preparar", forte: true };
    case 2:
      return { href: ciclo, rotulo: "Ver", forte: false };
    case 3:
      return { href: ciclo, rotulo: "Analisar", forte: true };
    case 4:
      return { href: `/app/${slug}/entregas/revisar?etapa=${id}`, rotulo: "Revisar", forte: true };
    case 5:
      return { href: `${ciclo}/enviar`, rotulo: "Enviar", forte: true };
    default:
      return { href: ciclo, rotulo: "Abrir", forte: false };
  }
}

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
  const trilhas = turma ? await trilhasDaTurma(supabase, empresa.id, turma, etapas ?? []) : new Map();
  // Resumo da turma: quem melhorou, quem caiu e quem precisa de atenção ao longo dos ciclos.
  const [{ data: gruposT }, { data: entregasT }] = turma && (etapas ?? []).length > 1
    ? await Promise.all([
        supabase.from("grupos").select("id").eq("org_id", empresa.id).eq("turma_id", turma.id).eq("ativo", true).limit(5000),
        supabase.from("entregas").select("grupo_id, etapa_id, analises(status, conceito)").in("etapa_id", (etapas ?? []).map((e) => e.id)).eq("status", "recebida").limit(20000),
      ])
    : [{ data: null }, { data: null }];
  const resumo = gruposT && entregasT ? resumoDaTurma(gruposT, etapas ?? [], entregasT as never, hojeISO()) : null;
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

      {resumo && (resumo.melhorou || resumo.caiu || resumo.atencao) ? (
        <Link
          href={`/app/${slug}/entregas/evolucao${resumo.atencao ? "?ver=atencao" : ""}`}
          className="toque flex items-center justify-between gap-3 rounded-2xl border border-borda bg-cartao px-4 py-3"
        >
          <span className="flex flex-col">
            <b className="text-sm">Como a turma está</b>
            <span className="text-[13px] text-suave">
              {[
                resumo.melhorou ? `${resumo.melhorou} ${resumo.melhorou === 1 ? "melhorou" : "melhoraram"} ↑` : "",
                resumo.caiu ? `${resumo.caiu} ${resumo.caiu === 1 ? "caiu" : "caíram"} ↓` : "",
                resumo.atencao ? `${resumo.atencao} ${resumo.atencao === 1 ? "precisa" : "precisam"} de atenção` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <span aria-hidden className="text-suave">›</span>
        </Link>
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
          {etapas.map((e) => {
            const t = trilhas.get(e.id)?.trilha as Trilha | undefined;
            const ir = t ? destinoDoPasso(slug, e.id, t) : null;
            const resumo = t && t.atual < 6 ? t.passos[t.atual - 1].resumo : null;
            return (
              <li key={e.id} className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
                <Link href={`/app/${slug}/etapas/${e.id}`} transitionTypes={["nav-forward"]} className="toque flex flex-col gap-2.5">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                    <span className="font-bold">
                      {v.etapa} {e.numero} · {e.titulo}
                    </span>
                    <span className={`text-xs ${t?.atual === 6 ? "font-bold text-ok" : "text-suave"}`}>
                      {t?.atual === 6 ? "✓ Concluído" : e.recebe_ate ? `prazo ${dataBR(e.recebe_ate)}` : "sem prazo"}
                    </span>
                  </span>
                  {t ? (
                    <span aria-hidden className="grid grid-cols-5 gap-1">
                      {t.passos.map((p) => (
                        <span
                          key={p.n}
                          className={`h-1.5 rounded-full ${t.atual === 6 ? "bg-ok" : p.estado === "feito" ? "bg-marca" : p.estado === "agora" ? "bg-marca/40" : "bg-borda"}`}
                        />
                      ))}
                    </span>
                  ) : null}
                  <span className="flex flex-wrap gap-x-2 text-xs text-suave">
                    {e.classroom_tarefa ? <span>{e.classroom_nosso ? "Publicado no Classroom" : "Veio do Classroom"}</span> : e.moodle_tarefa ? <span>Veio do Moodle</span> : null}
                  </span>
                </Link>
                {t && ir ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-marca">{rotuloDoPasso(t)}</span>
                      {resumo ? <span className="text-sm font-semibold">{resumo}</span> : null}
                    </span>
                    <Link
                      href={ir.href}
                      transitionTypes={["nav-forward"]}
                      aria-label={`${ir.rotulo}: ${v.etapa} ${e.numero}`}
                      className={`toque inline-flex min-h-10 shrink-0 items-center rounded-xl px-4 text-sm font-bold ${ir.forte ? "bg-marca text-sobre-marca" : "bg-marca-clara text-marca-forte"}`}
                    >
                      {ir.rotulo}
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

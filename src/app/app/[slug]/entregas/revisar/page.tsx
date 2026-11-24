import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkBotao } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario } from "@/lib/nomes";
import { parecidasDe } from "@/lib/parecidas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { RevisarUma } from "./revisar-uma";

export const metadata: Metadata = { title: "Revisar uma por uma" };

type Linha = {
  id: string;
  enviada_em: string;
  atrasada: boolean;
  grupos: { nome: string } | null;
  arquivos_entrega: { id: string; nome: string }[];
  links: string[];
  analises: { status: string; conceito_ia: string | null; conceito: string | null; devolutiva: string; justificativa: string; checklist: { item: string; status: string }[] } | null;
};

/**
 * Revisão em sequência (pensada para o celular): uma entrega por tela, com a
 * sugestão da IA, e "Aprovar e próxima". Pular manda para o fim da fila.
 */
export default async function Revisar({ params, searchParams }: PageProps<"/app/[slug]/entregas/revisar">) {
  const { slug } = await params;
  const { etapa: etapaId, pulei } = await searchParams;
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar || typeof etapaId !== "string" || !/^[0-9a-f-]{36}$/i.test(etapaId)) notFound();
  const vc = completarVocabulario(empresa.vocabulario);
  const supabase = await criarClienteServidor();
  const [{ data: etapa }, { data }] = await Promise.all([
    supabase.from("etapas").select("id, numero, titulo").eq("id", etapaId).eq("org_id", empresa.id).maybeSingle(),
    supabase
      .from("entregas")
      .select("id, enviada_em, atrasada, links, grupos(nome), arquivos_entrega(id, nome), analises(status, conceito_ia, conceito, devolutiva, justificativa, checklist)")
      .eq("org_id", empresa.id)
      .eq("etapa_id", etapaId)
      .eq("status", "recebida"),
  ]);
  if (!etapa) notFound();
  const fila = ((data ?? []) as unknown as Linha[])
    .filter((e) => e.analises?.status === "pronta")
    .sort((a, b) => (a.grupos?.nome ?? "").localeCompare(b.grupos?.nome ?? "", "pt-BR"));
  const pulados = new Set(typeof pulei === "string" ? pulei.split(",").filter(Boolean) : []);
  const atual = fila.find((e) => !pulados.has(e.id)) ?? fila[0];
  const base = `/app/${slug}/entregas`;
  const titulo = `${vc.etapa} ${etapa.numero} · ${etapa.titulo}`;

  if (!atual) {
    return (
      <section className="flex flex-col items-center gap-3 py-10 text-center">
        <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-ok-fundo text-2xl text-ok">
          ✓
        </span>
        <h1 className="text-2xl font-bold">Tudo revisado!</h1>
        <p className="text-suave">Não sobrou nenhuma devolutiva para revisar em {titulo}.</p>
        <LinkBotao href={`/app/${slug}/etapas/${etapa.id}/enviar`} transitionTypes={["nav-forward"]}>
          Próximo passo: enviar para os alunos
        </LinkBotao>
        <Link href={`/app/${slug}/etapas/${etapa.id}`} className="text-sm font-semibold text-marca-forte hover:underline">
          Voltar ao ciclo
        </Link>
      </section>
    );
  }

  const a = atual.analises!;
  const posicao = fila.indexOf(atual) + 1;
  const parecidas = await parecidasDe(supabase, atual.id);
  const proximoPulo = [...pulados, atual.id].join(",");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <Link href={`/app/${slug}/etapas/${etapa.id}`} transitionTypes={["nav-back"]} className="font-medium text-suave hover:text-texto">
          ← {titulo}
        </Link>
        <span className="shrink-0 font-semibold text-marca-forte">
          {posicao} de {fila.length} para revisar
        </span>
      </div>
      <span aria-hidden className="flex h-1.5 overflow-hidden rounded-full bg-marca-clara">
        <span className="bg-marca transition-[width] duration-300" style={{ width: `${Math.round(((posicao - 1) / fila.length) * 100)}%` }} />
      </span>
      <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-borda/60">
        <span className="block h-full rounded-full bg-marca" style={{ width: `${Math.round(((posicao - 1) / fila.length) * 100)}%` }} />
      </span>
      <div>
        <p className="text-xs text-suave">{titulo}</p>
        <h1 className="text-2xl font-bold">{atual.grupos?.nome ?? "?"}</h1>
        <p className="text-sm text-suave">
          Recebida {dataHoraBR(atual.enviada_em)}
          {atual.atrasada ? " · com atraso" : ""}
        </p>
      </div>
      {parecidas.length ? (
        <p role="note" className="rounded-xl bg-alerta-fundo px-3 py-2 text-sm text-alerta">
          Parecida com {parecidas.map((p) => `${p.grupo} (${p.percentual}%)`).join(", ")}. Vale conferir antes de aprovar.
        </p>
      ) : null}
      <RevisarUma
        key={atual.id}
        slug={slug}
        entregaId={atual.id}
        conceitoIa={a.conceito_ia}
        conceito={a.conceito ?? a.conceito_ia ?? "BOM"}
        devolutiva={a.devolutiva}
        justificativa={a.justificativa}
        checklist={(a.checklist ?? []).map((c) => ({ item: c.item, status: c.status }))}
        arquivos={atual.arquivos_entrega.map((f) => ({ nome: f.nome, href: `${base}/${atual.id}/arquivo/${f.id}` }))}
        links={atual.links ?? []}
        completa={`${base}/${atual.id}`}
        pularHref={fila.length > 1 ? `${base}/revisar?etapa=${etapa.id}&pulei=${proximoPulo}` : null}
      />
    </section>
  );
}

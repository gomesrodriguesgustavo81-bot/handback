import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario, quemEntrega } from "@/lib/nomes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";
import { ConfigMedia, EscolhaRelatorio } from "./escolha";

export const metadata: Metadata = { title: "Relatórios" };

export default async function Relatorios({ params }: PageProps<"/app/[slug]/relatorios">) {
  const { slug } = await params;
  const { empresa, podeAvaliar, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) notFound();
  const turma = await turmaAtual(empresa.id);
  if (!turma) notFound();
  const vc = completarVocabulario(empresa.vocabulario);
  const nomes = quemEntrega(vc, turma.modo);
  const supabase = await criarClienteServidor();
  const [{ data: grupos }, { data: etapas }, { data: t }] = await Promise.all([
    supabase.from("grupos").select("id, nome").eq("turma_id", turma.id).eq("ativo", true).eq("escondido", false).order("nome"),
    supabase.from("etapas").select("id, numero, titulo, peso, moodle_tarefa").eq("turma_id", turma.id).order("numero"),
    supabase.from("turmas").select("media_ativa").eq("id", turma.id).single(),
  ]);
  const temMoodle = Boolean(turma.moodle_conta) && (etapas ?? []).some((e) => e.moodle_tarefa);

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <Link href={`/app/${slug}/entregas`} className="text-sm text-suave hover:text-texto">
          ← Entregas
        </Link>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-suave">
          Da turma <strong>{turma.nome}</strong>. Em PDF para imprimir ou guardar, e em planilha para o sistema da escola.
        </p>
      </div>
      {grupos?.length ? (
        <EscolhaRelatorio
          slug={slug}
          grupos={grupos}
          palavraGrupo={nomes.um}
          palavraGrupos={nomes.varios}
          palavraMatricula={vc.matricula}
          palavraEtapa={vc.etapa}
          temMoodle={temMoodle}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-borda p-4 text-sm text-suave">Cadastre {nomes.varios.toLowerCase()} e receba entregas para ter relatórios.</p>
      )}
      {podeGerir && etapas?.length ? (
        <ConfigMedia
          slug={slug}
          ativa={Boolean(t?.media_ativa)}
          palavraEtapa={vc.etapa}
          etapas={etapas.map((e) => ({ id: e.id, numero: e.numero, titulo: e.titulo, peso: Number(e.peso ?? 1) }))}
        />
      ) : null}
    </div>
  );
}

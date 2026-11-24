import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario } from "@/lib/nomes";
import { turmaAtual } from "@/lib/turma";
import { LerPlano } from "./ler-plano";

export const metadata: Metadata = { title: "Criar a partir do plano de ensino" };

export default async function Plano({ params }: PageProps<"/app/[slug]/etapas/plano">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const vc = completarVocabulario(empresa.vocabulario);
  const turma = await turmaAtual(empresa.id);
  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <Link href={`/app/${slug}/etapas`} className="text-sm text-suave hover:text-texto">
        ← {vc.etapas}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Criar a partir do plano de ensino</h1>
        <p className="text-sm text-suave">
          Cole o plano (ou envie o PDF ou Word) e a IA monta {vc.etapas.toLowerCase()} do semestre{turma ? ` em ${turma.nome}` : ""}: título, prazo e o que entregar. Você revisa antes de criar.
        </p>
      </div>
      <LerPlano slug={slug} palavraEtapa={vc.etapa} palavraEtapas={vc.etapas} />
    </section>
  );
}

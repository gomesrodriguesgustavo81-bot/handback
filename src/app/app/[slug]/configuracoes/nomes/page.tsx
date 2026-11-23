import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario } from "@/lib/nomes";
import { FormNomes } from "./form-nomes";

export const metadata: Metadata = { title: "Nomes usados aqui" };

export default async function Nomes({ params }: PageProps<"/app/[slug]/configuracoes/nomes">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const v = completarVocabulario(empresa.vocabulario);
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Nomes usados aqui</h1>
        <p className="text-sm text-suave">Escreva como vocês falam no dia a dia. Os nomes aparecem nas abas, nas telas e nos e-mails.</p>
      </div>
      <FormNomes
        slug={slug}
        nome={empresa.nome}
        inicial={{ organizacao: v.organizacao, espaco: v.espaco, etapa: v.etapa, grupo: v.grupo, pessoa: v.pessoa, avaliador: v.avaliador, matricula: v.matricula }}
      />
    </div>
  );
}

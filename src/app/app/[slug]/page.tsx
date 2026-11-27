import { redirect } from "next/navigation";
import { contextoCoordenacao } from "@/lib/empresa";

/** Entrada da empresa: vai direto para o Início (o que fazer agora), ou para o primeiro acesso guiado. */
export default async function EntradaDaEmpresa({ params }: PageProps<"/app/[slug]">) {
  const { slug } = await params;
  const { empresa, podeAvaliar, podeGerir, ehCoordenacao } = await contextoCoordenacao(slug);
  if (ehCoordenacao) redirect(`/app/${slug}/coordenacao`);
  if (!empresa.configurada && podeGerir) redirect(`/app/${slug}/comecar`);
  redirect(podeAvaliar ? `/app/${slug}/inicio` : `/app/${slug}/etapas`);
}

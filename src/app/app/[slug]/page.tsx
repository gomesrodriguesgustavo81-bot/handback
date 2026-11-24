import { redirect } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";

/** Entrada da empresa: vai direto para o Início (o que fazer agora), ou para o primeiro acesso guiado. */
export default async function EntradaDaEmpresa({ params }: PageProps<"/app/[slug]">) {
  const { slug } = await params;
  const { empresa, podeAvaliar, podeGerir } = await contextoDaEmpresa(slug);
  if (!empresa.configurada && podeGerir) redirect(`/app/${slug}/comecar`);
  redirect(podeAvaliar ? `/app/${slug}/inicio` : `/app/${slug}/etapas`);
}

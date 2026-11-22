import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { Assistente } from "./assistente";

export const metadata: Metadata = { title: "Primeiro acesso" };

export default async function Comecar({ params }: PageProps<"/app/[slug]/comecar">) {
  const { slug } = await params;
  const { podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  return <Assistente slug={slug} />;
}

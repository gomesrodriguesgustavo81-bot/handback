import type { Metadata } from "next";
import Link from "next/link";
import { contextoCoordenacao } from "@/lib/empresa";

export const metadata: Metadata = { title: "Sem acesso à correção" };

/** Onde a coordenação cai ao tentar abrir telas de correção. O banco barra de qualquer jeito. */
export default async function SemAcesso({ params }: PageProps<"/app/[slug]/coordenacao/sem-acesso">) {
  const { slug } = await params;
  await contextoCoordenacao(slug);
  return (
    <section className="flex flex-col gap-4 sm:max-w-md">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-borda bg-cartao p-7 text-center">
        <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-marca-clara text-marca-forte">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 018 0v3" />
          </svg>
        </span>
        <h1 className="text-xl font-extrabold">Essa parte é de quem avalia</h1>
        <p className="text-sm leading-relaxed text-suave">
          Seu acesso de coordenação mostra números e conceitos aprovados. A correção (devolutiva, arquivos e análise da IA) fica só com a pessoa que avalia a turma.
        </p>
        <Link href={`/app/${slug}/coordenacao`} className="toque flex min-h-12 w-full items-center justify-center rounded-xl bg-marca text-[15px] font-bold text-sobre-marca">
          Voltar à coordenação
        </Link>
      </div>
    </section>
  );
}

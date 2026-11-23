import type { Metadata } from "next";
import { turmaAtual } from "@/lib/turma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { FormAcao } from "@/components/form-acao";
import { Cartao } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { minusc } from "@/lib/textos";
import { criarEtapa } from "../acoes";
import { CamposEtapa } from "../campos";

export const metadata: Metadata = { title: "Adicionar" };

export default async function NovaEtapa({ params }: PageProps<"/app/[slug]/etapas/nova">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const v = empresa.vocabulario;

  // Sugere o próximo número.
  const supabase = await criarClienteServidor();
  const turma = await turmaAtual(empresa.id);
  const { data: ultima } = await supabase
    .from("etapas")
    .select("numero")
    .eq("org_id", empresa.id)
    .eq("turma_id", turma?.id ?? "")
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <section className="flex flex-col gap-4">
      <Link href={`/app/${slug}/etapas`} className="text-sm text-suave hover:text-texto">
        ← {v.etapas}
      </Link>
      <Cartao className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Adicionar {minusc(v.etapa)}</h2>
        <FormAcao acao={criarEtapa.bind(null, slug)} textoBotao="Salvar" confirmar={{ titulo: `Adicionar ${minusc(v.etapa)}?`, sim: "Sim, adicionar" }}>
          <CamposEtapa v={v} inicial={{ numero: (ultima?.numero ?? 0) + 1 }} />
        </FormAcao>
      </Cartao>
    </section>
  );
}

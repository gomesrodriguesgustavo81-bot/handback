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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const doClassroom = Boolean(turma?.classroom_curso && turma.classroom_por === user?.id);
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
      <Link href={`/app/${slug}/etapas`} transitionTypes={["nav-back"]} className="text-sm text-suave hover:text-texto">
        ← {v.etapas}
      </Link>
      <Cartao className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Adicionar {minusc(v.etapa)}</h2>
        <FormAcao acao={criarEtapa.bind(null, slug)} textoBotao="Salvar" confirmar={{ titulo: `Adicionar ${minusc(v.etapa)}?`, sim: "Sim, adicionar" }}>
          <CamposEtapa v={v} inicial={{ numero: (ultima?.numero ?? 0) + 1 }} />
          {doClassroom ? (
            <label className="flex min-h-12 items-center gap-3 border-t border-borda pt-3">
              <input type="checkbox" name="publicar_classroom" defaultChecked className="size-5 shrink-0 accent-[var(--marca)]" />
              <span className="flex flex-col">
                <span className="font-semibold">Publicar também no Classroom</span>
                <span className="text-xs text-suave">A tarefa aparece para os alunos lá, e o Handback pode lançar a nota.</span>
              </span>
            </label>
          ) : null}
        </FormAcao>
      </Cartao>
    </section>
  );
}

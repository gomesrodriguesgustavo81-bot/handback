import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EscolhasIACampos } from "@/components/escolhas-ia";
import { FormAcao } from "@/components/form-acao";
import { contextoDaEmpresa } from "@/lib/empresa";
import { COLUNAS_ESCOLHAS, resolverEscolhas, type LinhaEscolhas } from "@/lib/ia/escolhas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { salvarEscolhasConta } from "../../ia-acoes";

export const metadata: Metadata = { title: "Como a IA ajuda" };

/** As escolhas da conta inteira: o padrão de todas as turmas (cada turma pode mudar em Ajustes da turma). */
export default async function EscolhasDaIA({ params }: PageProps<"/app/[slug]/configuracoes/ia">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("organizacoes").select(COLUNAS_ESCOLHAS).eq("id", empresa.id).maybeSingle();
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Como a IA ajuda</h1>
        <p className="text-sm text-suave">
          O padrão de todas as turmas de {empresa.nome}. A decisão e a assinatura das devolutivas são sempre suas: a IA só prepara rascunhos.
        </p>
      </div>
      <FormAcao acao={salvarEscolhasConta.bind(null, slug)} textoBotao="Salvar escolhas">
        <EscolhasIACampos valores={resolverEscolhas(data as LinhaEscolhas | null)} />
      </FormAcao>
      <p className="text-xs leading-relaxed text-suave">
        Cada turma pode ter escolhas próprias em Ajustes da turma. Mudar aqui vale para as turmas que seguem a conta.{" "}
        <Link href={`/app/${slug}/relatorios/supervisao`} className="font-semibold text-marca-forte underline">
          Ver o registro de supervisão
        </Link>
      </p>
    </div>
  );
}

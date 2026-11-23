import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BotaoConfirmar, FormAcao } from "@/components/form-acao";
import { Aviso, Cartao } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataBR, minusc } from "@/lib/textos";
import { apagarEtapa, salvarEtapa } from "../acoes";
import { CamposEtapa } from "../campos";

async function carregar(slug: string, id: string) {
  const ctx = await contextoDaEmpresa(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await criarClienteServidor();
  const { data: etapa } = await supabase
    .from("etapas")
    .select("id, numero, titulo, data, recebe_de, recebe_ate, entregaveis, criterios, observacoes_ia")
    .eq("org_id", ctx.empresa.id)
    .eq("id", id)
    .maybeSingle();
  if (!etapa) notFound();
  return { ...ctx, etapa };
}

export async function generateMetadata({ params }: PageProps<"/app/[slug]/etapas/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const { empresa, etapa } = await carregar(slug, id);
  return { title: `${empresa.vocabulario.etapa} ${etapa.numero} · ${etapa.titulo}` };
}

export default async function DetalheEtapa({ params, searchParams }: PageProps<"/app/[slug]/etapas/[id]">) {
  const { slug, id } = await params;
  const { salvo } = await searchParams;
  const { empresa, podeGerir, etapa } = await carregar(slug, id);
  const v = empresa.vocabulario;

  return (
    <section className="flex flex-col gap-4">
      <Link href={`/app/${slug}/etapas`} className="text-sm text-suave hover:text-texto">
        ← {v.etapas}
      </Link>

      {podeGerir ? (
        <>
          {salvo ? <Aviso>Cadastro salvo.</Aviso> : null}
          <Cartao className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">
              {v.etapa} {etapa.numero} · {etapa.titulo}
            </h2>
            <FormAcao acao={salvarEtapa.bind(null, slug, id)} textoBotao="Salvar alterações">
              <CamposEtapa v={v} inicial={etapa} />
            </FormAcao>
          </Cartao>
          <div className="flex justify-end">
            <BotaoConfirmar
              acao={apagarEtapa.bind(null, slug, id)}
              pergunta={`Apagar “${v.etapa} ${etapa.numero} · ${etapa.titulo}”? Isso não pode ser desfeito.`}
            >
              Apagar {minusc(v.etapa)}
            </BotaoConfirmar>
          </div>
        </>
      ) : (
        <Cartao className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            {v.etapa} {etapa.numero} · {etapa.titulo}
          </h2>
          <dl className="grid grid-cols-1 gap-3 text-sm">
            {etapa.data ? <Item titulo="Data">{dataBR(etapa.data)}</Item> : null}
            <Item titulo="Recebe entregas">
              {etapa.recebe_ate
                ? `${etapa.recebe_de ? `de ${dataBR(etapa.recebe_de)} ` : ""}até ${dataBR(etapa.recebe_ate)}`
                : "Sem prazo definido"}
            </Item>
            <Item titulo="O que deve ser entregue">
              {etapa.entregaveis.length ? (
                <ul className="list-disc pl-5">
                  {etapa.entregaveis.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                "Nenhum item cadastrado."
              )}
            </Item>
            {etapa.criterios ? <Item titulo="Critérios de qualidade">{etapa.criterios}</Item> : null}
          </dl>
        </Cartao>
      )}
    </section>
  );
}

function Item({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-suave">{titulo}</dt>
      <dd className="whitespace-pre-line">{children}</dd>
    </div>
  );
}

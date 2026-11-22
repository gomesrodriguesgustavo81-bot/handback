import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoConfirmar, FormAcao } from "@/components/form-acao";
import { Cartao } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { minusc } from "@/lib/textos";
import { apagarGrupo, salvarGrupo } from "../acoes";
import { CamposGrupo } from "../campos";

async function carregar(slug: string, id: string) {
  const ctx = await contextoDaEmpresa(slug);
  if (!ctx.podeAvaliar || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await criarClienteServidor();
  const { data: grupo } = await supabase
    .from("grupos")
    .select("id, nome, tema, observacoes, ativo, integrantes(email)")
    .eq("org_id", ctx.empresa.id)
    .eq("id", id)
    .maybeSingle();
  if (!grupo) notFound();
  return { ...ctx, grupo };
}

export async function generateMetadata({ params }: PageProps<"/app/[slug]/grupos/[id]">): Promise<Metadata> {
  const { slug, id } = await params;
  const { grupo } = await carregar(slug, id);
  return { title: grupo.nome };
}

export default async function DetalheGrupo({ params }: PageProps<"/app/[slug]/grupos/[id]">) {
  const { slug, id } = await params;
  const { empresa, podeGerir, grupo } = await carregar(slug, id);
  const v = empresa.vocabulario;
  const emails = grupo.integrantes.map((i) => i.email).sort();

  return (
    <section className="flex flex-col gap-4">
      <Link href={`/app/${slug}/grupos`} className="text-sm text-suave hover:text-texto">
        ← {v.grupos}
      </Link>
      <Cartao className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{grupo.nome}</h2>
        {podeGerir ? (
          <FormAcao acao={salvarGrupo.bind(null, slug, id)} textoBotao="Salvar alterações">
            <CamposGrupo v={v} inicial={{ ...grupo, emails }} editando />
          </FormAcao>
        ) : (
          <dl className="grid gap-3 text-sm">
            {grupo.tema ? (
              <div>
                <dt className="text-suave">Tema ou projeto</dt>
                <dd>{grupo.tema}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-suave">E-mails de quem entrega</dt>
              <dd className="break-words">{emails.length ? emails.join(", ") : "Nenhum e-mail cadastrado"}</dd>
            </div>
            {grupo.observacoes ? (
              <div>
                <dt className="text-suave">Observações</dt>
                <dd className="whitespace-pre-line">{grupo.observacoes}</dd>
              </div>
            ) : null}
          </dl>
        )}
      </Cartao>
      {podeGerir ? (
        <div className="flex justify-end">
          <BotaoConfirmar
            acao={apagarGrupo.bind(null, slug, id)}
            pergunta={`Apagar “${grupo.nome}”? Isso não pode ser desfeito.`}
          >
            Apagar {minusc(v.grupo)}
          </BotaoConfirmar>
        </div>
      ) : null}
    </section>
  );
}

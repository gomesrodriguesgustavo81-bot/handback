import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAcao } from "@/components/form-acao";
import { Cartao, Selo, Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { minusc } from "@/lib/textos";
import { criarGrupo } from "./acoes";
import { CamposGrupo } from "./campos";

export async function generateMetadata({ params }: PageProps<"/app/[slug]/grupos">): Promise<Metadata> {
  const { slug } = await params;
  const { empresa } = await contextoDaEmpresa(slug);
  return { title: `${empresa.vocabulario.grupos} · ${empresa.nome}` };
}

export default async function ListaGrupos({ params }: PageProps<"/app/[slug]/grupos">) {
  const { slug } = await params;
  const { empresa, podeGerir, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) notFound();
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();
  const { data: grupos } = await supabase
    .from("grupos")
    .select("id, nome, tema, ativo, integrantes(email)")
    .eq("org_id", empresa.id)
    .order("nome");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {v.grupos} ({grupos?.length ?? 0})
        </h2>
        {!grupos?.length ? (
          <Vazio>Nada cadastrado ainda.{podeGerir ? " Use o formulário para adicionar." : ""}</Vazio>
        ) : (
          <ul className="flex flex-col gap-3">
            {grupos.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/app/${slug}/grupos/${g.id}`}
                  className="flex flex-col gap-1 rounded-2xl border border-borda bg-cartao p-4 hover:border-marca"
                >
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {g.nome}
                    {!g.ativo ? <Selo>Pausado</Selo> : null}
                  </span>
                  {g.tema ? <span className="text-sm">{g.tema}</span> : null}
                  <span className="break-words text-sm text-suave">
                    {g.integrantes.length
                      ? g.integrantes.map((i) => i.email).join(", ")
                      : "Nenhum e-mail cadastrado"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {podeGerir ? (
        <Cartao className="flex flex-col gap-4 self-start">
          <h2 className="font-semibold">Adicionar {minusc(v.grupo)}</h2>
          <FormAcao acao={criarGrupo.bind(null, slug)} textoBotao="Adicionar" limparAoSalvar>
            <CamposGrupo v={v} />
          </FormAcao>
        </Cartao>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import { turmaAtual } from "@/lib/turma";
import { completarVocabulario, generoDe, quemEntrega } from "@/lib/nomes";
import { ColarLista } from "@/components/colar-lista";
import { notFound } from "next/navigation";
import { FormAcao } from "@/components/form-acao";
import { FormConfirmado } from "@/components/confirmar";
import { Cartao, Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { minusc } from "@/lib/textos";
import { cadastrarEmLote, criarGrupo, restaurarGrupo } from "./acoes";
import { CamposGrupo } from "./campos";
import { CartaoGrupo } from "./cartao-grupo";

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
  const turma = await turmaAtual(empresa.id);
  const { data: todos } = await supabase
    .from("grupos")
    .select("id, nome, tema, ativo, moodle_id, escondido, integrantes(email, nome)")
    .eq("org_id", empresa.id)
    .eq("turma_id", turma?.id ?? "")
    .order("nome");

  const apagados = (todos ?? []).filter((g) => g.escondido);
  const grupos = (todos ?? []).filter((g) => !g.escondido);
  const vc = completarVocabulario(v);
  const individual = turma?.modo === "individual";
  const nomes = quemEntrega(vc, turma?.modo ?? "grupos");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {nomes.varios} ({grupos?.length ?? 0})
        </h2>
        {!grupos?.length ? (
          <Vazio>Nada cadastrado ainda.{podeGerir ? " Use o formulário para adicionar." : ""}</Vazio>
        ) : (
          <ul className="flex flex-col gap-3">
            {grupos.map((g) => (
              <CartaoGrupo
                key={g.id}
                slug={slug}
                podeGerir={podeGerir}
                palavra={nomes.um}
                doMoodle={Boolean(g.moodle_id)}
                g={{ id: g.id, nome: g.nome, tema: g.tema, ativo: g.ativo, pessoas: g.integrantes }}
              />
            ))}
          </ul>
        )}
        {podeGerir && apagados.length ? (
          <details className="rounded-2xl border border-dashed border-borda p-4">
            <summary className="flex min-h-10 cursor-pointer items-center font-medium text-suave">Apagadas ({apagados.length})</summary>
            <p className="mt-1 text-sm text-suave">Vieram do Moodle e foram apagadas (ou eram a turma inteira). Ficam guardadas para você trazer de volta se quiser.</p>
            <ul className="mt-2 flex flex-col divide-y divide-borda">
              {apagados.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-sm">
                    <strong>{g.nome}</strong> · {g.integrantes.length} {g.integrantes.length === 1 ? "pessoa" : "pessoas"}
                  </span>
                  <FormConfirmado action={restaurarGrupo.bind(null, slug, g.id)} pergunta={{ titulo: `Trazer “${g.nome}” de volta?`, texto: "Volta para a lista e passa a receber entregas de novo.", sim: "Sim, trazer de volta" }}>
                    <button type="submit" className="inline-flex min-h-11 items-center rounded-xl border border-borda px-3 text-sm font-medium text-marca-forte hover:bg-fundo">
                      Trazer de volta
                    </button>
                  </FormConfirmado>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {podeGerir && individual ? (
        <Cartao className="flex flex-col gap-4 self-start">
          <h2 className="font-semibold">Adicionar {nomes.varios.toLowerCase()} de uma vez</h2>
          <ColarLista acao={cadastrarEmLote.bind(null, slug)} umNome={nomes.um} variosNome={nomes.varios} />
        </Cartao>
      ) : podeGerir ? (
        <Cartao className="flex flex-col gap-4 self-start">
          <h2 className="font-semibold">Adicionar {minusc(v.grupo)}</h2>
          <FormAcao acao={criarGrupo.bind(null, slug)} textoBotao="Adicionar" limparAoSalvar confirmar={{ titulo: `Adicionar est${generoDe(v.grupo) === "f" ? "a" : "e"} ${minusc(v.grupo)}?`, sim: "Sim, adicionar" }}>
            <CamposGrupo v={v} />
          </FormAcao>
        </Cartao>
      ) : null}
    </div>
  );
}

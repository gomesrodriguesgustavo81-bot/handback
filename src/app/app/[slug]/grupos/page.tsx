import type { Metadata } from "next";
import { turmaAtual } from "@/lib/turma";
import { completarVocabulario, o, quemEntrega } from "@/lib/nomes";
import { notFound } from "next/navigation";
import { FormConfirmado } from "@/components/confirmar";
import { Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { restaurarGrupo } from "./acoes";
import { AcoesEquipes } from "./acoes-equipes";
import { IconeDrive, pastaDaTurmaNoDrive } from "@/lib/pastas-drive";
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
    .select("id, nome, tema, ativo, moodle_id, escondido, integrantes(id, email, nome)")
    .eq("org_id", empresa.id)
    .eq("turma_id", turma?.id ?? "")
    .order("nome");

  const apagados = (todos ?? []).filter((g) => g.escondido);
  const grupos = (todos ?? []).filter((g) => !g.escondido);
  const vc = completarVocabulario(v);
  const individual = turma?.modo === "individual";
  const nomes = quemEntrega(vc, turma?.modo ?? "grupos");
  const pessoas = grupos.reduce((n, g) => n + g.integrantes.length, 0);
  const pastaDrive = turma ? await pastaDaTurmaNoDrive(supabase, turma.id) : null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">{nomes.varios}</h2>
        <span className="text-sm text-suave">
          {grupos.length} {grupos.length === 1 ? "cadastro" : "cadastros"} · {pessoas} {pessoas === 1 ? "pessoa" : "pessoas"}
        </span>
      </div>
      {pastaDrive ? (
        <a
          href={pastaDrive}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-borda bg-cartao px-3 text-sm font-semibold text-marca-forte hover:bg-fundo"
        >
          <IconeDrive /> Abrir a pasta da turma no Google Drive
        </a>
      ) : null}
      {podeGerir ? (
        <AcoesEquipes
          slug={slug}
          individual={individual}
          umaEquipe={individual ? nomes.um : v.grupo}
          equipes={individual ? nomes.varios : v.grupos}
          cadastros={grupos.map((g) => ({ id: g.id, nome: g.nome, pessoas: g.integrantes.map((p) => ({ id: p.id, nome: p.nome ?? "", email: p.email })) }))}
        />
      ) : null}
      {!grupos.length ? (
        <Vazio>Nada cadastrado ainda.{podeGerir ? " Use os botões acima para adicionar." : ""}</Vazio>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
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
          <p className="mt-1 text-sm text-suave">
            Vieram do Moodle e foram apagadas, eram a turma inteira, ou ficaram vazias quando as pessoas foram para outr{o(vc, "grupo")} {vc.grupo.toLowerCase()}. Ficam
            guardadas, com as entregas, para você trazer de volta se quiser.
          </p>
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
  );
}

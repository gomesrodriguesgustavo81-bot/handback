import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Campo, Cartao, Escolha } from "@/components/ui";
import { FormAcao } from "@/components/form-acao";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario, o } from "@/lib/nomes";
import { turmaAtual, turmasDaEmpresa } from "@/lib/turma";
import { criarTurma, salvarTurma } from "../../ajustes/acoes";

export const metadata: Metadata = { title: "Turmas" };

export default async function Turmas({ params }: PageProps<"/app/[slug]/configuracoes/turmas">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const v = empresa.vocabulario;
  const vc = completarVocabulario(v);
  const [turmas, turma] = await Promise.all([turmasDaEmpresa(empresa.id), turmaAtual(empresa.id)]);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
    <Cartao id="turmas" className="flex scroll-mt-6 flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{vc.espacos}</h2>
        <p className="text-sm text-suave">
          Cada {vc.espaco.toLowerCase()} tem {o(vc, "etapa", true)} {vc.etapas.toLowerCase()}, {vc.grupos.toLowerCase()} ou {vc.pessoas.toLowerCase()} e o
          endereço de e-mail próprios. Os ajustes abaixo valem para todas.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {turmas.map((t) => (
          <li key={t.id} className="rounded-xl border border-borda p-3">
            <FormAcao acao={salvarTurma.bind(null, slug, t.id)} textoBotao="Salvar">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Campo rotulo="Nome" name="nome" required defaultValue={t.nome} />
                <Escolha
                  rotulo="Quem entrega"
                  name="modo"
                  defaultValue={t.modo}
                  opcoes={[
                    { valor: "grupos", nome: `${vc.grupos} (com ${vc.pessoas.toLowerCase()} dentro)` },
                    { valor: "individual", nome: `${vc.pessoas} individualmente` },
                  ]}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="arquivada" defaultChecked={t.arquivada} className="size-5" />
                Arquivada (some do topo, mas nada é apagado)
              </label>
            </FormAcao>
          </li>
        ))}
      </ul>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-marca-forte">+ Criar {vc.espaco.toLowerCase()}</summary>
        <div className="mt-3">
          <FormAcao acao={criarTurma.bind(null, slug)} textoBotao="Criar" limparAoSalvar confirmar={{ titulo: "Criar esta turma?", sim: "Sim, criar" }}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome" name="nome" required placeholder="Ex.: Cálculo II — Manhã" />
              <Escolha
                rotulo="Quem entrega"
                name="modo"
                defaultValue={turma?.modo ?? "grupos"}
                opcoes={[
                  { valor: "grupos", nome: `${vc.grupos} (com ${vc.pessoas.toLowerCase()} dentro)` },
                  { valor: "individual", nome: `${vc.pessoas} individualmente` },
                ]}
              />
            </div>
          </FormAcao>
        </div>
      </details>
    </Cartao>

    </div>
  );
}

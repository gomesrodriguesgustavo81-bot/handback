import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormAcao } from "@/components/form-acao";
import { Campo, Cartao } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { salvarAjustes } from "./acoes";

export const metadata: Metadata = { title: "Ajustes" };

export default async function Ajustes({ params }: PageProps<"/app/[slug]/ajustes">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const v = empresa.vocabulario;

  return (
    <Cartao className="flex max-w-2xl flex-col gap-4">
      <h2 className="text-lg font-semibold">Ajustes da empresa</h2>
      <FormAcao acao={salvarAjustes.bind(null, slug)} textoBotao="Salvar ajustes">
        <Campo rotulo="Nome da empresa" name="nome" required defaultValue={empresa.nome} />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-medium">Palavras usadas no dia a dia</legend>
          <p className="text-sm text-suave">
            Troque pelas palavras que as pessoas daqui usam. Elas aparecem nos menus, nas telas e, depois, nos e-mails.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Etapa (uma)" name="etapa" required defaultValue={v.etapa} dica="Ex.: Aula, Ciclo, Encontro" />
            <Campo rotulo="Etapas (várias)" name="etapas" required defaultValue={v.etapas} />
            <Campo rotulo="Quem avalia (um)" name="avaliador" required defaultValue={v.avaliador} dica="Ex.: Professor, Gestor" />
            <Campo rotulo="Quem avalia (vários)" name="avaliadores" required defaultValue={v.avaliadores} />
            <Campo rotulo="Quem entrega (um)" name="grupo" required defaultValue={v.grupo} dica="Ex.: Equipe, Time, Cliente" />
            <Campo rotulo="Quem entrega (vários)" name="grupos" required defaultValue={v.grupos} />
          </div>
        </fieldset>
      </FormAcao>
    </Cartao>
  );
}

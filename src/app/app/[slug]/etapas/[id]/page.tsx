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
import { CopiarMensagemDaAula } from "@/components/endereco-turma";
import { enderecoDeRecebimento } from "@/lib/emails/endereco";
import { dadosDaMensagem } from "@/lib/mensagem-turma";
import { marcarMensagemCopiada } from "../../turma-acoes";

async function carregar(slug: string, id: string) {
  const ctx = await contextoDaEmpresa(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await criarClienteServidor();
  const { data: etapa } = await supabase
    .from("etapas")
    .select("id, numero, titulo, data, recebe_de, recebe_ate, entregaveis, criterios, observacoes_ia, turma_id")
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
  const { empresa, podeGerir, podeAvaliar, etapa } = await carregar(slug, id);
  const v = empresa.vocabulario;
  // Mensagem pronta desta aula para a turma (prazo, o que entregar e o assunto exato).
  const supabase = await criarClienteServidor();
  const { data: turma } = await supabase.from("turmas").select("id, modo, caixa_token").eq("id", etapa.turma_id).maybeSingle();
  const endereco = turma ? enderecoDeRecebimento(turma.caixa_token) : null;
  const dadosMsg = podeAvaliar && turma && endereco ? await dadosDaMensagem(supabase, empresa, { id: turma.id, modo: turma.modo }) : null;
  const copiar =
    endereco && dadosMsg ? (
      <Cartao className="flex flex-col gap-2">
        <h2 className="font-semibold">Mandar para a turma</h2>
        <p className="text-sm text-suave">A mensagem já vem com o prazo, o que entregar e o assunto certo. Cole no WhatsApp, no Moodle ou no e-mail da turma.</p>
        <CopiarMensagemDaAula endereco={endereco} dados={dadosMsg} aulaId={etapa.id} aoCopiar={marcarMensagemCopiada.bind(null, slug)} />
      </Cartao>
    ) : null;

  return (
    <section className="flex flex-col gap-4">
      <Link href={`/app/${slug}/etapas`} className="text-sm text-suave hover:text-texto">
        ← {v.etapas}
      </Link>
      {copiar}

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

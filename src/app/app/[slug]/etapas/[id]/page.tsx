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
import { ClassroomDoCiclo } from "@/components/classroom-ciclo";

/** Números do Classroom deste ciclo (entregas, arquivos que chegaram e que esperam). */
async function infoClassroom(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  etapa: { id: string; entregaveis: string[] | null; classroom_tarefa: string | null; classroom_nosso: boolean; classroom_link: string },
  dono: string | null,
  podeGerir: boolean,
) {
  const [{ data: eu }, { data: entregas }, { data: pendentes }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("entregas").select("id, links, comentario, arquivos_entrega(count)").eq("etapa_id", etapa.id).eq("origem", "classroom").eq("status", "recebida"),
    supabase.from("classroom_pendentes").select("entrega_id").eq("etapa_id", etapa.id).limit(2000),
  ]);
  const lista = (entregas ?? []) as { id: string; links: string[]; comentario: string; arquivos_entrega: { count: number }[] }[];
  const meu = Boolean(dono && dono === eu.user?.id);
  const comEspera = new Set((pendentes ?? []).map((p) => String(p.entrega_id)));
  return {
    tarefa: Boolean(etapa.classroom_tarefa),
    nosso: etapa.classroom_nosso,
    link: etapa.classroom_link,
    entregaram: lista.length,
    noHandback: lista.reduce((n, e) => n + (e.arquivos_entrega[0]?.count ?? 0), 0),
    esperando: pendentes?.length ?? 0,
    soLink: lista.filter((e) => !(e.arquivos_entrega[0]?.count ?? 0) && !comEspera.has(e.id)).length,
    meu,
    podePublicar: meu && podeGerir,
    semChecklist: !(etapa.entregaveis ?? []).length,
  };
}

async function carregar(slug: string, id: string) {
  const ctx = await contextoDaEmpresa(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await criarClienteServidor();
  const { data: etapa } = await supabase
    .from("etapas")
    .select("id, numero, titulo, data, recebe_de, recebe_ate, entregaveis, criterios, observacoes_ia, turma_id, classroom_tarefa, classroom_nosso, classroom_link")
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
  const { data: turma } = await supabase.from("turmas").select("id, modo, caixa_token, classroom_curso, classroom_por").eq("id", etapa.turma_id).maybeSingle();
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

  const classroom = podeAvaliar && turma?.classroom_curso ? await infoClassroom(supabase, etapa, turma.classroom_por, podeGerir) : null;

  return (
    <section className="flex flex-col gap-4">
      <Link href={`/app/${slug}/etapas`} className="text-sm text-suave hover:text-texto">
        ← {v.etapas}
      </Link>
      {copiar}
      {classroom ? <ClassroomDoCiclo slug={slug} etapaId={etapa.id} info={classroom} /> : null}

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

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
import { AnalisarVarias, FilaAndando } from "@/components/analise";
import { LinkBotao } from "@/components/ui";
import { trilhasDaTurma } from "@/lib/trilha-dados";
import { LembrarQuemFalta } from "./lembrar";
import { DobraEditar } from "./dobra-editar";
import type { Passo, Trilha } from "@/lib/trilha";

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
  const { salvo, erro } = await searchParams;
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
  const dados = podeAvaliar && turma ? (await trilhasDaTurma(supabase, empresa.id, turma, [etapa])).get(etapa.id) : undefined;
  const trilha = dados?.trilha;
  const cartaoClassroom = classroom ? <ClassroomDoCiclo slug={slug} etapaId={etapa.id} info={classroom} /> : null;
  const painel = `/app/${slug}/entregas?etapa=${etapa.id}`;

  // O que aparece dentro do passo atual: sempre um próximo passo claro.
  const acaoDoPasso = (n: Passo["n"]) => {
    if (!dados) return null;
    const c = dados.contagem;
    switch (n) {
      case 1:
        return (
          <>
            {!c.checklist ? (
              <p className="text-sm text-suave">Escreva logo abaixo, em “Editar”, o que o aluno precisa entregar. A IA confere item por item.</p>
            ) : null}
            {cartaoClassroom}
          </>
        );
      case 2:
        return (
          <>
            {cartaoClassroom ?? copiar}
            <div className="flex flex-wrap gap-2">
              <LinkBotao href={painel} variante="secundario" className="text-sm">
                Ver quem já entregou
              </LinkBotao>
              <LembrarQuemFalta slug={slug} etapaId={etapa.id} faltam={Math.max(0, c.total - c.entregaram)} />
            </div>
          </>
        );
      case 3:
        return (
          <>
            {c.analisando ? <FilaAndando quantas={c.analisando} /> : null}
            <AnalisarVarias forte slug={slug} entregas={dados.semAnalise} rotulo={`Analisar ${dados.semAnalise.length === 1 ? "a entrega" : `as ${dados.semAnalise.length} entregas`} com a IA`} />
          </>
        );
      case 4:
        return (
          <LinkBotao href={`/app/${slug}/entregas/revisar?etapa=${etapa.id}`} transitionTypes={["nav-forward"]}>
            Revisar as devolutivas ({c.revisar})
          </LinkBotao>
        );
      case 5:
        return (
          <LinkBotao href={`/app/${slug}/etapas/${etapa.id}/enviar`} transitionTypes={["nav-forward"]}>
            Enviar para os alunos ({c.enviar})
          </LinkBotao>
        );
    }
  };
  // Mostrados fora da trilha quando o passo deles não é o atual (continuam sempre à mão).
  const extras = (
    <>
      {trilha && trilha.atual > 2 ? cartaoClassroom : null}
      {trilha && trilha.atual !== 2 && !cartaoClassroom ? copiar : null}
    </>
  );
  const abrirEdicao = Boolean(salvo || erro || (dados && !dados.contagem.checklist));

  return (
    <section className="flex flex-col gap-4">
      <Link href={`/app/${slug}/etapas`} transitionTypes={["nav-back"]} className="self-start text-sm text-suave hover:text-texto">
        ← {v.etapas}
      </Link>
      <div className="flex flex-col gap-0.5">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {v.etapa} {etapa.numero} · {etapa.titulo}
        </h1>
        <p className="text-sm text-suave">
          {etapa.recebe_ate ? `Recebe ${etapa.recebe_de ? `de ${dataBR(etapa.recebe_de)} ` : ""}até ${dataBR(etapa.recebe_ate)}` : "Sem prazo definido"}
        </p>
      </div>

      {trilha ? <TrilhaDoCiclo trilha={trilha} acao={acaoDoPasso} painel={painel} relatorio={`/app/${slug}/entregas/relatorio?etapa=${etapa.id}`} /> : null}
      {extras}
      {!trilha && copiar}

      {podeGerir ? (
        <>
          {salvo ? <Aviso>Cadastro salvo.</Aviso> : null}
          {typeof erro === "string" ? <Aviso tipo="erro">{erro}</Aviso> : null}
          <DobraEditar abertoNoInicio={abrirEdicao} titulo={`Editar ${minusc(v.etapa)} (nome, prazo, checklist)`}>
            <FormAcao acao={salvarEtapa.bind(null, slug, id)} textoBotao="Salvar alterações">
              <CamposEtapa v={v} inicial={etapa} />
            </FormAcao>
          </DobraEditar>
          <div className="flex justify-end">
            <BotaoConfirmar
              acao={apagarEtapa.bind(null, slug, id)}
              pergunta={`Apagar “${v.etapa} ${etapa.numero} · ${etapa.titulo}”? Isso não pode ser desfeito.${
                etapa.classroom_tarefa
                  ? etapa.classroom_nosso
                    ? " A tarefa também é apagada do Google Classroom, com o que os alunos entregaram lá."
                    : " A tarefa continua no Google Classroom (foi criada lá), mas o Handback para de trazer as entregas dela."
                  : ""
              }`}
            >
              Apagar {minusc(v.etapa)}
            </BotaoConfirmar>
          </div>
        </>
      ) : (
        <Cartao className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">O que pedir</h2>
          <dl className="grid grid-cols-1 gap-3 text-sm">
            {etapa.data ? <Item titulo="Data">{dataBR(etapa.data)}</Item> : null}
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

/** A trilha de 5 passos: feitos com ✓, o atual aberto com o botão, os próximos em cinza. */
function TrilhaDoCiclo({ trilha, acao, painel, relatorio }: { trilha: Trilha; acao: (n: Passo["n"]) => ReactNode; painel: string; relatorio: string }) {
  return (
    <div className="flex flex-col gap-3">
      <ol aria-label="Passos do ciclo" className="flex flex-col">
        {trilha.passos.map((p, i) => {
          const ultimo = i === trilha.passos.length - 1;
          const feito = p.estado === "feito" || trilha.atual === 6;
          return (
            <li key={p.n} aria-current={p.estado === "agora" ? "step" : undefined} className="flex gap-3.5">
              <span className="flex flex-col items-center">
                <span
                  aria-hidden
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold ${
                    feito ? "bg-ok text-white" : p.estado === "agora" ? "bg-marca text-sobre-marca ring-4 ring-marca-clara" : "border-2 border-borda bg-cartao text-suave"
                  }`}
                >
                  {feito ? "✓" : p.n}
                </span>
                {ultimo ? null : <span aria-hidden className={`w-0.5 flex-1 ${feito ? "bg-ok" : "bg-borda"} min-h-4`} />}
              </span>
              {p.estado === "agora" && trilha.atual !== 6 ? (
                <section aria-label={`Agora: ${p.nome}`} className="mb-4 flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-marca">Agora</span>
                    <b className="text-lg leading-snug">{p.nome}</b>
                    <span className="text-sm text-suave">{p.resumo}</span>
                  </span>
                  {acao(p.n)}
                </section>
              ) : (
                <span className={`flex min-w-0 flex-col pt-1 ${ultimo ? "" : "pb-4"}`}>
                  <b className={`text-[15px] ${p.estado === "depois" && trilha.atual !== 6 ? "text-suave" : ""}`}>{p.nome}</b>
                  <span className="text-[13px] text-suave">{p.resumo}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {trilha.atual === 6 ? (
        <p role="status" className="rounded-2xl bg-ok-fundo px-4 py-3 text-sm font-semibold text-ok">
          Ciclo concluído: tudo enviado. ✓
        </p>
      ) : null}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <Link href={painel} className="text-sm font-semibold text-marca-forte hover:underline">
          Todas as entregas deste ciclo ›
        </Link>
        <Link href={relatorio} className="text-sm font-semibold text-marca-forte hover:underline">
          Relatório ›
        </Link>
      </div>
    </div>
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

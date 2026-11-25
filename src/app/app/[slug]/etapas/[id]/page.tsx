import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BotaoConfirmar, FormAcao } from "@/components/form-acao";
import { Aviso, Cartao } from "@/components/ui";
import { SeloConceito } from "@/components/conceito";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataBR, hojeISO, minusc } from "@/lib/textos";
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
import { MenuDobra } from "@/components/menu-dobra";
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
  const alunos = podeAvaliar && turma ? await alunosDoCiclo(supabase, empresa.id, turma.id, etapa.id, etapa.recebe_ate) : [];

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
            <LembrarQuemFalta slug={slug} etapaId={etapa.id} faltam={Math.max(0, c.total - c.entregaram)} />
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="text-2xl font-extrabold tracking-tight lg:text-[28px]">
            {v.etapa} {etapa.numero} · {etapa.titulo}
          </h1>
          <p className="text-sm text-suave">
            {etapa.recebe_ate ? `Recebe ${etapa.recebe_de ? `de ${dataBR(etapa.recebe_de)} ` : ""}até ${dataBR(etapa.recebe_ate)}` : "Sem prazo definido"}
          </p>
        </div>
        {podeAvaliar ? (
          <MenuDobra
            rotulo={
              <>
                Mais <span aria-hidden>▾</span>
              </>
            }
          >
              <Link href={painel} className="flex min-h-11 items-center rounded-lg px-3 text-[15px] hover:bg-fundo">
                Painel de entregas (filtros e busca)
              </Link>
              <Link href={`${painel}&registrar=1#registrar`} className="flex min-h-11 items-center rounded-lg px-3 text-[15px] hover:bg-fundo">
                Registrar entrega à mão
              </Link>
              <Link href={`/app/${slug}/entregas/relatorio?etapa=${etapa.id}`} className="flex min-h-11 items-center rounded-lg px-3 text-[15px] hover:bg-fundo">
                Relatório
              </Link>
              {podeGerir ? (
                <a href="#editar" className="flex min-h-11 items-center rounded-lg px-3 text-[15px] hover:bg-fundo">
                  Editar {minusc(v.etapa)}
                </a>
              ) : null}
          </MenuDobra>
        ) : null}
      </div>

      {trilha ? <TrilhaDoCiclo trilha={trilha} acao={acaoDoPasso} /> : null}
      {alunos.length ? <ListaDeAlunos alunos={alunos} base={`/app/${slug}/entregas`} /> : null}
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

/**
 * A trilha de 5 passos. Celular: em pé; computador: lado a lado. Embaixo,
 * o cartão do passo atual com UM botão grande.
 */
function TrilhaDoCiclo({ trilha, acao }: { trilha: Trilha; acao: (n: Passo["n"]) => ReactNode }) {
  const agora = trilha.atual < 6 ? trilha.passos[trilha.atual - 1] : null;
  return (
    <div className="flex flex-col gap-3">
      <ol aria-label="Passos do ciclo" className="flex flex-col lg:grid lg:grid-cols-5 lg:gap-2">
        {trilha.passos.map((p, i) => {
          const ultimo = i === trilha.passos.length - 1;
          const feito = p.estado === "feito" || trilha.atual === 6;
          const atual = p.estado === "agora" && trilha.atual !== 6;
          return (
            <li
              key={p.n}
              aria-current={atual ? "step" : undefined}
              className={`flex gap-3 lg:flex-col lg:gap-1 lg:rounded-2xl lg:px-3.5 lg:py-3 ${
                atual ? "lg:bg-marca lg:text-sobre-marca lg:shadow-[0_6px_16px_rgb(47_91_234/0.25)]" : "lg:border lg:border-borda lg:bg-cartao"
              }`}
            >
              <span className="flex flex-col items-center lg:hidden">
                <span
                  aria-hidden
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold ${
                    feito ? "bg-ok text-white" : atual ? "bg-marca text-sobre-marca ring-4 ring-marca-clara" : "border-2 border-borda bg-cartao text-suave"
                  }`}
                >
                  {feito ? "✓" : p.n}
                </span>
                {ultimo ? null : <span aria-hidden className={`min-h-3 w-0.5 flex-1 ${feito ? "bg-ok" : "bg-borda"}`} />}
              </span>
              <span className={`flex min-w-0 flex-col pt-1 lg:pt-0 ${ultimo ? "" : "pb-3 lg:pb-0"}`}>
                <span className={`hidden text-xs font-bold lg:block ${atual ? "text-sobre-marca/80" : feito ? "text-ok" : "text-suave"}`}>
                  {feito ? "✓ " : ""}
                  {atual ? "AGORA · " : ""}
                  {p.n} · {p.nome}
                </span>
                <b className={`text-[15px] lg:hidden ${p.estado === "depois" && trilha.atual !== 6 ? "text-suave" : ""}`}>{p.nome}</b>
                <span className={`text-[13px] lg:text-sm lg:font-semibold ${atual ? "lg:text-sobre-marca" : "text-suave lg:text-texto"} ${p.estado === "depois" && trilha.atual !== 6 ? "lg:text-suave" : ""}`}>
                  {p.resumo}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {agora ? (
        <section aria-label={`Agora: ${agora.nome}`} className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:p-5">
          <span className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-marca">Agora · passo {agora.n} de 5</span>
            <b className="text-lg leading-snug">{agora.nome}</b>
            <span className="text-sm text-suave">{agora.resumo}</span>
          </span>
          <div className="flex flex-col gap-2 lg:max-w-md lg:items-end">{acao(agora.n)}</div>
        </section>
      ) : (
        <p role="status" className="rounded-2xl bg-ok-fundo px-4 py-3 text-sm font-semibold text-ok">
          Ciclo concluído: tudo enviado. ✓
        </p>
      )}
    </div>
  );
}

type Aluno = { id: string; nome: string; entrega: string | null; situacao: string; tom: string; conceito: string | null; feitos: number; itens: number; ordem: number };

/** Quem entrega neste ciclo: situação, conceito e checklist de cada um (o que precisa de você primeiro). */
async function alunosDoCiclo(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  orgId: string,
  turmaId: string,
  etapaId: string,
  prazo: string | null,
): Promise<Aluno[]> {
  const [{ data: grupos }, { data: entregas }] = await Promise.all([
    supabase.from("grupos").select("id, nome").eq("org_id", orgId).eq("turma_id", turmaId).eq("ativo", true).order("nome").limit(2000),
    supabase
      .from("entregas")
      .select("id, grupo_id, analises(status, conceito, checklist, enviada_em, moodle_enviada_em, classroom_enviada_em)")
      .eq("etapa_id", etapaId)
      .eq("status", "recebida")
      .limit(2000),
  ]);
  type A = { status: string; conceito: string | null; checklist: { status: string }[] | null; enviada_em: string | null; moodle_enviada_em: string | null; classroom_enviada_em: string | null };
  const de = new Map(((entregas ?? []) as unknown as { id: string; grupo_id: string; analises: A | A[] | null }[]).map((e) => [e.grupo_id, e]));
  const passou = Boolean(prazo && hojeISO() > prazo);
  return (grupos ?? [])
    .map((g) => {
      const e = de.get(g.id);
      const a = e ? (Array.isArray(e.analises) ? e.analises[0] : e.analises) : null;
      const lista = a?.checklist ?? [];
      const base = { id: g.id, nome: g.nome as string, entrega: e?.id ?? null, conceito: null as string | null, feitos: lista.filter((c) => c.status === "ENTREGUE").length, itens: lista.length };
      if (!e) return { ...base, situacao: passou ? "Não entregou" : "Aguardando", tom: passou ? "bg-erro-fundo text-erro" : "bg-neutro-fundo text-neutro", ordem: passou ? 5 : 6 };
      if (!a) return { ...base, situacao: "Sem análise", tom: "bg-alerta-fundo text-alerta", ordem: 1 };
      if (a.status === "pronta") return { ...base, conceito: a.conceito, situacao: "Para revisar", tom: "bg-alerta-fundo text-alerta", ordem: 0 };
      if (a.status === "aprovada")
        return a.enviada_em || a.moodle_enviada_em || a.classroom_enviada_em
          ? { ...base, conceito: a.conceito, situacao: "Enviada", tom: "bg-ok-fundo text-ok", ordem: 4 }
          : { ...base, conceito: a.conceito, situacao: "Aprovada", tom: "bg-marca-clara text-marca-forte", ordem: 2 };
      if (a.status === "analisando") return { ...base, situacao: "Analisando", tom: "bg-info-fundo text-info", ordem: 3 };
      return { ...base, situacao: "Falhou", tom: "bg-erro-fundo text-erro", ordem: 1 };
    })
    .sort((x, y) => x.ordem - y.ordem || x.nome.localeCompare(y.nome, "pt-BR"));
}

function ListaDeAlunos({ alunos, base }: { alunos: Aluno[]; base: string }) {
  return (
    <section aria-label="Quem entrega" className="flex flex-col overflow-hidden rounded-2xl border border-borda bg-cartao">
      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_5rem] gap-3 border-b border-borda px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-suave lg:grid">
        <span>Quem</span>
        <span>Situação</span>
        <span>Conceito</span>
        <span>Checklist</span>
        <span />
      </div>
      <ul className="flex flex-col divide-y divide-borda">
        {alunos.map((x) => {
          const conteudo = (
            <>
              <b className="min-w-0 truncate text-[15px]">{x.nome}</b>
              <span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${x.tom}`}>{x.situacao}</span>
              </span>
              <span className="hidden lg:block">{x.conceito ? <SeloConceito conceito={x.conceito} /> : <span className="text-suave">—</span>}</span>
              <span className="hidden text-sm text-suave lg:block">{x.itens ? `${x.feitos} de ${x.itens}` : "—"}</span>
              <span className="hidden text-right text-sm font-bold text-marca lg:block">{x.entrega ? "Abrir ›" : ""}</span>
            </>
          );
          const classe = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_5rem] lg:px-5";
          return (
            <li key={x.id}>
              {x.entrega ? (
                <Link href={`${base}/${x.entrega}`} className={`toque ${classe} hover:bg-fundo`}>
                  {conteudo}
                </Link>
              ) : (
                <div className={classe}>{conteudo}</div>
              )}
            </li>
          );
        })}
      </ul>
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

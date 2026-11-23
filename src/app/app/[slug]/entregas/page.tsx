import type { Metadata } from "next";
import { FaltamPassos, passosDoComeco } from "../primeiros-passos";
import { turmaAtual } from "@/lib/turma";
import { completarVocabulario, quemEntrega } from "@/lib/nomes";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormEntrega } from "@/components/form-entrega";
import { AnalisarVarias, AprovarProntas } from "@/components/analise";
import {
  Dobra,
  Pilula,
  PilulaSituacao,
  SeloConceito,
  type Situacao,
} from "@/components/conceito";
import { EscolhaEtapa } from "@/components/escolha-etapa";
import { Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { lerConfigSupabase } from "@/lib/supabase/config";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataBR, dataHoraBR, hojeISO, minusc, passouMaisDe } from "@/lib/textos";
import {
  etapaDaVez,
  etapasDaEmpresa,
  opcoesDeEtapa,
  situacaoDoPrazo,
} from "./dados";
import { NavEntregas } from "./navegacao";
import { FaixaGmail } from "./faixa-gmail";
import { FilaAndando } from "@/components/analise";
import { AvisoGmail } from "@/components/aviso-gmail";
import { EnviarVarias } from "@/components/envio";
import { meuGmail } from "@/lib/envio";
import { gmailConfigurado } from "@/lib/gmail";
import { after } from "next/server";
import { FaixaMoodle } from "./faixa-moodle";
import { sincronizarTurma } from "@/lib/moodle/sincronizar";
import { criarClienteAdmin } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Entregas" };
export const maxDuration = 300;

const FILTROS = {
  todas: "Todas",
  revisar: "Para revisar",
  aprovadas: "Aprovadas",
  sem: "Sem entrega",
} as const;
type Filtro = keyof typeof FILTROS;

type EntregaLinha = {
  id: string;
  grupo_id: string;
  enviada_em: string;
  atrasada: boolean;
  status: "recebida" | "substituida";
  origem: "email" | "manual";
  analises: {
    status: string;
    conceito: string | null;
    checklist: { status: string }[];
    iniciada_em: string;
    enviada_em: string | null;
    moodle_enviada_em: string | null;
  } | null;
};

export default async function PainelDaAula({
  params,
  searchParams,
}: PageProps<"/app/[slug]/entregas">) {
  const { slug } = await params;
  const {
    etapa: etapaEscolhida,
    filtro: filtroPedido,
    gmail: avisoGmail,
    busca: buscaPedida,
  } = await searchParams;
  const busca =
    typeof buscaPedida === "string" ? buscaPedida.trim().slice(0, 80) : "";
  const filtro: Filtro =
    typeof filtroPedido === "string" && filtroPedido in FILTROS
      ? (filtroPedido as Filtro)
      : "todas";
  const { empresa, podeAvaliar, podeGerir } = await contextoDaEmpresa(slug);
  const config = lerConfigSupabase();
  if (!podeAvaliar || !config) notFound();
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();

  const turma = await turmaAtual(empresa.id);
  const tId = turma?.id ?? "";
  const [etapas, { count: paraConfirmar }] = await Promise.all([
    etapasDaEmpresa(empresa.id, tId),
    supabase
      .from("emails_recebidos")
      .select("id", { count: "exact", head: true })
      .eq("org_id", empresa.id)
      .eq("turma_id", tId)
      .eq("status", "confirmar"),
  ]);
  // Turma ligada ao Moodle: busca sozinha as novidades (no máximo a cada 15 minutos), sem segurar a tela.
  let faixaMoodle = null;
  if (turma?.moodle_conta) {
    const turmaId = turma.id;
    if (!turma.moodle_buscado_em || passouMaisDe(turma.moodle_buscado_em, 15)) {
      after(async () => {
        const admin = criarClienteAdmin();
        if (admin) await sincronizarTurma(admin, turmaId, 15 * 60).catch((e) => console.error("[moodle] busca automática", e));
      });
    }
    const { data: tarefas } = await supabase
      .from("etapas")
      .select("id, numero, titulo, recebe_ate, moodle_corrigir")
      .eq("turma_id", turma.id)
      .not("moodle_tarefa", "is", null)
      .order("numero");
    faixaMoodle = (
      <FaixaMoodle
        slug={slug}
        disciplina={turma.moodle_curso_nome || turma.nome}
        ultimaBusca={
          turma.moodle_buscado_em
            ? `Olhou o Moodle em ${dataHoraBR(turma.moodle_buscado_em)} · busca sozinho quando você abre a turma`
            : "Ainda não olhou o Moodle"
        }
        erro={turma.moodle_erro}
        podeMarcar={podeGerir}
        ajustesHref={podeGerir ? `/app/${slug}/moodle` : null}
        tarefas={(tarefas ?? []).map((t) => ({
          id: t.id,
          nome: `${v.etapa} ${t.numero} · ${t.titulo}`,
          detalhe: t.recebe_ate ? `Prazo ${dataBR(t.recebe_ate)}` : "Sem prazo",
          corrigir: t.moodle_corrigir,
        }))}
      />
    );
  }
  const nav = (
    <>
      {podeGerir ? <FaltamPassos slug={slug} passos={await passosDoComeco(slug, empresa)} /> : null}
      <NavEntregas
        slug={slug}
        atual="painel"
        paraConfirmar={paraConfirmar ?? 0}
      />
      {faixaMoodle}
    </>
  );

  if (!etapas.length) {
    return (
      <div className="flex flex-col gap-4">
        {nav}
        <Vazio>
          Primeiro cadastre {minusc(v.etapas)} em{" "}
          <Link
            href={`/app/${slug}/etapas`}
            className="text-marca-forte underline"
          >
            {v.etapas}
          </Link>
          .
        </Vazio>
      </div>
    );
  }
  const etapa =
    etapas.find((e) => e.id === etapaEscolhida) ?? etapaDaVez(etapas)!;
  const prazoPassou = Boolean(etapa.recebe_ate && hojeISO() > etapa.recebe_ate);

  const [{ data: grupos }, { data }, gmail] = await Promise.all([
    supabase
      .from("grupos")
      .select("id, nome, tema")
      .eq("org_id", empresa.id)
      .eq("turma_id", tId)
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("entregas")
      .select(
        "id, grupo_id, enviada_em, atrasada, status, origem, analises(status, conceito, checklist, iniciada_em, enviada_em, moodle_enviada_em)",
      )
      .eq("etapa_id", etapa.id)
      .eq("status", "recebida"),
    meuGmail(supabase),
  ]);
  const valendo = new Map(
    ((data ?? []) as unknown as EntregaLinha[]).map((e) => [e.grupo_id, e]),
  );
  // Entregas na fila de análise em segundo plano (desta aula).
  const idsDaAula = [...valendo.values()].map((e) => e.id);
  const { data: fila } = idsDaAula.length
    ? await supabase.from("fila_analises").select("entrega_id").in("entrega_id", idsDaAula).is("feita_em", null)
    : { data: [] as { entrega_id: string }[] };
  const naFila = new Set((fila ?? []).map((f) => f.entrega_id as string));

  const situacaoDe = (e: EntregaLinha | undefined): Situacao => {
    if (!e) return prazoPassou ? "nao-entregou" : "aguardando";
    const a = e.analises;
    if (!a) return "sem-analise";
    if (a.status === "aprovada") return a.enviada_em || a.moodle_enviada_em ? "enviada" : "aprovada";
    if (a.status === "pronta") return "revisar";
    if (a.status === "analisando")
      return passouMaisDe(a.iniciada_em, 5) ? "falhou" : "analisando";
    return "falhou";
  };
  const equipes = (grupos ?? []).map((g) => {
    const e = valendo.get(g.id);
    const situacao = situacaoDe(e);
    const lista = e?.analises?.checklist ?? [];
    const feitos = lista.filter((c) => c.status === "ENTREGUE").length;
    const temAnalise = ["aprovada", "enviada", "revisar"].includes(situacao);
    return {
      g,
      e,
      situacao,
      feitos,
      total: lista.length,
      conceito: temAnalise ? e?.analises?.conceito : null,
    };
  });

  const total = equipes.length;
  const recebidas = equipes.filter((x) => x.e).length;
  const paraRevisar = equipes.filter((x) => x.situacao === "revisar").length;
  const aprovadas = equipes.filter(
    (x) => x.situacao === "aprovada" || x.situacao === "enviada",
  ).length;
  const enviadas = equipes.filter((x) => x.situacao === "enviada").length;
  const paraEnviar = equipes
    .filter((x) => x.situacao === "aprovada")
    .map((x) => ({ id: x.e!.id, nome: x.g.nome }));
  const gmailConfig = gmailConfigurado();
  const gmailEmail = gmail && !gmail.invalida ? gmail.email : null;
  const semAnalise = equipes
    .filter(
      (x) => x.e && !naFila.has(x.e.id) && (x.situacao === "sem-analise" || x.situacao === "falhou"),
    )
    .map((x) => ({ id: x.e!.id, nome: x.g.nome }));

  const individual = turma?.modo === "individual";
  const nomes = quemEntrega(completarVocabulario(v), turma?.modo ?? "grupos");
  const termo = individual ? busca.toLowerCase() : "";
  const visiveis = equipes
    .filter((x) => !termo || x.g.nome.toLowerCase().includes(termo))
    .filter((x) =>
      filtro === "revisar"
        ? x.situacao === "revisar"
        : filtro === "aprovadas"
          ? x.situacao === "aprovada" || x.situacao === "enviada"
          : filtro === "sem"
            ? !x.e
            : true,
    );
  const contagem: Record<Filtro, number> = {
    todas: total,
    revisar: paraRevisar,
    aprovadas,
    sem: total - recebidas,
  };
  const base = `/app/${slug}/entregas`;
  const conectarHref = `/api/gmail/conectar?voltar=${encodeURIComponent(`${base}?etapa=${etapa.id}`)}`;

  return (
    <div className="flex flex-col gap-4">
      {nav}

      <EscolhaEtapa
        rotulo={v.etapa}
        atual={etapa.id}
        base={base}
        opcoes={etapas.map((e) => ({
          id: e.id,
          nome: `${v.etapa} ${e.numero} · ${e.titulo}`,
        }))}
        detalhe={`${situacaoDoPrazo(etapa)[0].toUpperCase()}${situacaoDoPrazo(etapa).slice(1)} · ${turma?.moodle_conta ? "recebe pelo Moodle" : "recebe por e-mail"}`}
      />

      <dl className="grid grid-cols-4 gap-2 sm:max-w-2xl">
        <Numero
          rotulo="Recebidas"
          valor={`${recebidas}/${total}`}
          classe="border-borda bg-cartao"
        />
        <Numero
          rotulo="Para revisar"
          valor={String(paraRevisar)}
          classe="border-alerta/25 bg-alerta-fundo text-alerta"
        />
        <Numero
          rotulo="Aprovadas"
          valor={String(aprovadas)}
          classe="border-marca/25 bg-marca-clara text-marca-forte"
        />
        <Numero
          rotulo="Enviadas"
          valor={String(enviadas)}
          classe="border-borda bg-cartao"
        />
      </dl>

      <AvisoGmail aviso={avisoGmail} />

      {naFila.size ? <FilaAndando quantas={naFila.size} /> : null}

      {semAnalise.length || paraRevisar || (paraEnviar.length && gmailEmail) ? (
        <div className="grid grid-cols-1 gap-2 sm:max-w-2xl sm:grid-cols-2">
          <AnalisarVarias
            slug={slug}
            entregas={semAnalise}
            rotulo={`Analisar com IA as ${semAnalise.length} sem análise`}
          />
          <AprovarProntas
            slug={slug}
            etapaId={etapa.id}
            quantas={paraRevisar}
          />
          {gmailEmail ? (
            <EnviarVarias
              slug={slug}
              entregas={paraEnviar}
              conectarHref={conectarHref}
            />
          ) : null}
        </div>
      ) : null}

      {gmailConfig ? (
        <FaixaGmail
          slug={slug}
          email={gmailEmail}
          invalida={Boolean(gmail?.invalida)}
          conectarHref={conectarHref}
          pendentes={paraEnviar.length}
        />
      ) : null}

      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <Link
          href={`${base}/relatorio?etapa=${etapa.id}`}
          className="text-sm font-semibold text-marca-forte hover:underline"
        >
          Relatório da aula →
        </Link>
        <Link
          href={`${base}/calibracao`}
          className="text-sm font-semibold text-marca-forte hover:underline"
        >
          Como a IA está indo →
        </Link>
        <Link
          href={`${base}/evolucao`}
          className="text-sm font-semibold text-marca-forte hover:underline"
        >
          Evolução →
        </Link>
        <Link
          href={`/app/${slug}/relatorios`}
          className="text-sm font-semibold text-marca-forte hover:underline"
        >
          Relatórios (PDF e planilha) →
        </Link>
      </div>

      {individual ? (
        <form action={base} className="flex gap-2">
          <input type="hidden" name="etapa" value={etapa.id} />
          {filtro !== "todas" ? (
            <input type="hidden" name="filtro" value={filtro} />
          ) : null}
          <label className="flex min-w-0 flex-1">
            <span className="sr-only">Buscar {nomes.um.toLowerCase()}</span>
            <input
              name="busca"
              defaultValue={busca}
              placeholder={`Buscar ${nomes.um.toLowerCase()} pelo nome`}
              className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
            />
          </label>
          <button
            type="submit"
            className="min-h-11 rounded-xl border border-borda bg-cartao px-4 text-sm font-medium hover:bg-fundo"
          >
            Buscar
          </button>
        </form>
      ) : null}

      <nav
        aria-label={`Filtrar ${nomes.varios.toLowerCase()}`}
        className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <ul className="flex min-w-max gap-1.5">
          {(Object.keys(FILTROS) as Filtro[]).map((f) => (
            <li key={f}>
              <Link
                href={`${base}?etapa=${etapa.id}${f === "todas" ? "" : `&filtro=${f}`}`}
                aria-current={f === filtro ? "true" : undefined}
                className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-semibold ${
                  f === filtro
                    ? "border-texto bg-texto text-fundo"
                    : "border-borda bg-cartao text-suave hover:text-texto"
                }`}
              >
                {FILTROS[f]} ({contagem[f]})
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!total ? (
        <Vazio>
          Cadastre {minusc(v.grupos)} em{" "}
          <Link
            href={`/app/${slug}/grupos`}
            className="text-marca-forte underline"
          >
            {v.grupos}
          </Link>{" "}
          para acompanhar as entregas.
        </Vazio>
      ) : !visiveis.length ? (
        <Vazio>Nenhuma equipe neste filtro.</Vazio>
      ) : individual ? (
        <ul
          aria-label={nomes.varios}
          className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-cartao"
        >
          {visiveis.map(({ g, e, situacao, conceito }) => {
            const linha = (
              <>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">
                    {g.nome}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <PilulaSituacao situacao={situacao} />
                    {e?.atrasada ? (
                      <Pilula className="bg-ruim-fundo text-ruim">
                        Atrasada
                      </Pilula>
                    ) : null}
                  </span>
                </span>
                <SeloConceito conceito={conceito} />
              </>
            );
            return (
              <li key={g.id}>
                {e ? (
                  <Link
                    href={`${base}/${e.id}`}
                    className="flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-fundo"
                  >
                    {linha}
                  </Link>
                ) : (
                  <div className="flex min-h-14 items-center gap-3 px-3 py-2">
                    {linha}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {visiveis.map(
            ({ g, e, situacao, feitos, total: itens, conceito }) => {
              const pct = itens ? Math.round((feitos / itens) * 100) : 0;
              const corpo = (
                <>
                  <span className="flex items-start justify-between gap-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="break-words text-base font-semibold">
                        {g.nome}
                      </span>
                      {g.tema ? (
                        <span className="break-words text-[13px] text-suave">
                          {g.tema}
                        </span>
                      ) : null}
                    </span>
                    <SeloConceito conceito={conceito} grande />
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutro-fundo">
                      <span
                        className={`block h-full rounded-full ${pct >= 80 ? "bg-marca" : pct >= 50 ? "bg-reg" : "bg-ruim"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </span>
                    <span className="whitespace-nowrap text-xs text-suave">
                      {conceito
                        ? `${feitos}/${itens} itens entregues`
                        : "— itens"}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <PilulaSituacao situacao={situacao} />
                    {e?.atrasada ? (
                      <Pilula className="bg-ruim-fundo text-ruim">
                        Atrasada
                      </Pilula>
                    ) : null}
                    {e?.origem === "manual" ? (
                      <Pilula className="bg-neutro-fundo text-neutro">
                        Registrada à mão
                      </Pilula>
                    ) : null}
                    {e ? (
                      <span className="ml-auto text-xs text-suave">
                        {dataHoraBR(e.enviada_em).slice(0, 5)}
                      </span>
                    ) : null}
                  </span>
                </>
              );
              return (
                <li key={g.id}>
                  {e ? (
                    <Link
                      href={`${base}/${e.id}`}
                      className="flex h-full flex-col gap-2.5 rounded-2xl border border-borda bg-cartao p-4 transition-colors hover:border-marca"
                    >
                      {corpo}
                    </Link>
                  ) : (
                    <div className="flex h-full flex-col gap-2.5 rounded-2xl border border-dashed border-borda p-4">
                      {corpo}
                    </div>
                  )}
                </li>
              );
            },
          )}
        </ul>
      )}

      {total ? (
        <Dobra titulo="Registrar entrega à mão" extra="em mãos, WhatsApp…">
          <FormEntrega
            slug={slug}
            orgId={empresa.id}
            supabaseConfig={config}
            etapas={opcoesDeEtapa(etapas, v)}
            grupos={grupos ?? []}
            etapaInicial={etapa.id}
            nomeEtapa={v.etapa}
            nomeGrupo={v.grupo}
          />
        </Dobra>
      ) : null}
    </div>
  );
}

function Numero({
  rotulo,
  valor,
  classe,
}: {
  rotulo: string;
  valor: string;
  classe: string;
}) {
  return (
    <div
      className={`flex flex-col-reverse gap-0.5 rounded-xl border px-2 py-2.5 sm:px-3 ${classe}`}
    >
      <dt className="text-[11px] leading-tight opacity-90 sm:text-xs">
        {rotulo}
      </dt>
      <dd className="text-xl font-bold">{valor}</dd>
    </div>
  );
}

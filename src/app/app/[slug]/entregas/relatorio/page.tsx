import type { Metadata } from "next";
import { turmaAtual } from "@/lib/turma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PilulaSituacao, SeloConceito, type Situacao } from "@/components/conceito";
import { AcoesRelatorio } from "@/components/imprimir";
import { Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { registrarDocumento } from "@/lib/registro";
import { dataHoraBR, hojeISO, dataBR } from "@/lib/textos";
import { etapaDaVez, etapasDaEmpresa, situacaoDoPrazo } from "../dados";

export const metadata: Metadata = { title: "Relatório da aula" };

type Linha = {
  grupo_id: string;
  enviada_em: string;
  atrasada: boolean;
  analises: { status: string; conceito: string | null; checklist: { status: string }[]; devolutiva: string; enviada_em: string | null } | null;
};

const ORDEM = ["EXCELENTE", "BOM", "REGULAR", "RUIM", "PENDENTE"];

/** Resumo de uma etapa: conceito de cada equipe e as devolutivas aprovadas, pronto para imprimir. */
export default async function RelatorioDaAula({ params, searchParams }: PageProps<"/app/[slug]/entregas/relatorio">) {
  const { slug } = await params;
  const { etapa: escolhida } = await searchParams;
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) notFound();
  const v = empresa.vocabulario;
  const turma = await turmaAtual(empresa.id);
  const etapas = await etapasDaEmpresa(empresa.id, turma?.id ?? "");
  const etapa = etapas.find((e) => e.id === escolhida) ?? etapaDaVez(etapas);
  if (!etapa) return <Vazio>Nada cadastrado em {v.etapas} ainda.</Vazio>;
  const supabase = await criarClienteServidor();
  const [{ data: grupos }, { data }] = await Promise.all([
    supabase.from("grupos").select("id, nome, tema").eq("org_id", empresa.id).eq("turma_id", turma?.id ?? "").eq("ativo", true).order("nome"),
    supabase
      .from("entregas")
      .select("grupo_id, enviada_em, atrasada, analises(status, conceito, checklist, devolutiva, enviada_em)")
      .eq("etapa_id", etapa.id)
      .eq("status", "recebida"),
  ]);
  const porGrupo = new Map(((data ?? []) as unknown as Linha[]).map((e) => [e.grupo_id, e]));
  const prazoPassou = Boolean(etapa.recebe_ate && hojeISO() > etapa.recebe_ate);

  const linhas = (grupos ?? []).map((g) => {
    const e = porGrupo.get(g.id);
    const a = e?.analises;
    const situacao: Situacao = !e
      ? prazoPassou
        ? "nao-entregou"
        : "aguardando"
      : !a
        ? "sem-analise"
        : a.status === "aprovada"
          ? a.enviada_em
            ? "enviada"
            : "aprovada"
          : a.status === "pronta"
            ? "revisar"
            : a.status === "analisando"
              ? "analisando"
              : "falhou";
    const aprovada = a?.status === "aprovada";
    const itens = a?.checklist ?? [];
    return {
      nome: g.nome,
      tema: g.tema as string,
      situacao,
      atrasada: Boolean(e?.atrasada),
      conceito: aprovada ? a!.conceito : null,
      itens: itens.length ? `${itens.filter((c) => c.status === "ENTREGUE").length}/${itens.length}` : "—",
      devolutiva: aprovada ? a!.devolutiva : "",
    };
  });
  const contagem = ORDEM.map((c) => ({ c, n: linhas.filter((l) => l.conceito === c).length })).filter((x) => x.n);
  const recebidas = linhas.filter((l) => !["nao-entregou", "aguardando"].includes(l.situacao)).length;
  const titulo = `${v.etapa} ${etapa.numero} · ${etapa.titulo}`;
  await registrarDocumento(supabase, empresa.id, "abriu_relatorio", `Abriu o relatório da aula: ${titulo}`, etapa.id);

  const texto = [
    `${empresa.nome} — ${titulo}`,
    `Relatório de ${dataHoraBR(new Date().toISOString())}`,
    `Recebidas: ${recebidas} de ${linhas.length}`,
    contagem.length ? `Conceitos: ${contagem.map((x) => `${x.c} ${x.n}`).join(" · ")}` : "",
    "",
    ...linhas.flatMap((l) => [
      `${l.nome}: ${l.conceito ?? "sem conceito aprovado"}${l.atrasada ? " (com atraso)" : ""} · itens ${l.itens}`,
      ...(l.devolutiva ? [l.devolutiva, ""] : [""]),
    ]),
  ]
    .filter((x, i, arr) => x !== "" || arr[i - 1] !== "")
    .join("\n");

  return (
    <section className="flex flex-col gap-4">
      <Link href={`/app/${slug}/entregas?etapa=${etapa.id}`} className="text-sm font-semibold text-marca-forte hover:underline print:hidden">
        ← Painel
      </Link>
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-suave">Relatório da aula</p>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        <p className="text-sm text-suave">
          {empresa.nome} · {etapa.recebe_ate ? `prazo ${dataBR(etapa.recebe_ate)}` : situacaoDoPrazo(etapa)} · gerado em {dataHoraBR(new Date().toISOString())}
        </p>
      </header>
      <AcoesRelatorio texto={texto} />

      <dl className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-borda bg-cartao p-4 text-sm">
        <div>
          <dt className="text-suave">Recebidas</dt>
          <dd className="text-lg font-bold">
            {recebidas}/{linhas.length}
          </dd>
        </div>
        {contagem.map((x) => (
          <div key={x.c}>
            <dt className="text-suave">{x.c}</dt>
            <dd className="text-lg font-bold">{x.n}</dd>
          </div>
        ))}
      </dl>

      <ol className="flex flex-col gap-3">
        {linhas.map((l) => (
          <li key={l.nome} className="flex break-inside-avoid flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="break-words font-semibold">{l.nome}</span>
                {l.tema ? <span className="break-words text-[13px] text-suave">{l.tema}</span> : null}
              </div>
              <SeloConceito conceito={l.conceito} grande />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-suave">
              <PilulaSituacao situacao={l.situacao} />
              {l.atrasada ? <span>com atraso</span> : null}
              <span>itens entregues: {l.itens}</span>
            </div>
            {l.devolutiva ? <p className="whitespace-pre-line text-sm leading-relaxed">{l.devolutiva}</p> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

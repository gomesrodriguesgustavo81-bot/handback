import type { Metadata } from "next";
import { turmaAtual } from "@/lib/turma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ESTILO_CONCEITO, Pilula } from "@/components/conceito";
import { Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { evolucaoDaEquipe, ROTULO_TENDENCIA, type Celula, type Tendencia } from "@/lib/evolucao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeISO, minusc } from "@/lib/textos";
import { etapasDaEmpresa } from "../dados";

export const metadata: Metadata = { title: "Evolução das equipes" };

const FILTROS = { todas: "Todas", atencao: "Precisam de atenção", caiu: "Caíram", melhorou: "Melhoraram" } as const;
type Filtro = keyof typeof FILTROS;

const ESTILO_TENDENCIA: Record<Tendencia, { classe: string; seta: string }> = {
  melhorou: { classe: "bg-ok-fundo text-ok", seta: "↑" },
  caiu: { classe: "bg-ruim-fundo text-ruim", seta: "↓" },
  manteve: { classe: "bg-neutro-fundo text-neutro", seta: "→" },
  "sem-dados": { classe: "bg-neutro-fundo text-neutro", seta: "·" },
};

type Linha = { id: string; grupo_id: string; etapa_id: string; analises: { status: string; conceito: string | null } | null };

export default async function Evolucao({ params, searchParams }: PageProps<"/app/[slug]/entregas/evolucao">) {
  const { slug } = await params;
  const { ver } = await searchParams;
  const filtro: Filtro = typeof ver === "string" && ver in FILTROS ? (ver as Filtro) : "todas";
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) notFound();
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();
  const turma = await turmaAtual(empresa.id);
  const tId = turma?.id ?? "";
  const [etapas, { data: grupos }, { data }] = await Promise.all([
    etapasDaEmpresa(empresa.id, tId),
    supabase.from("grupos").select("id, nome, tema").eq("org_id", empresa.id).eq("turma_id", tId).eq("ativo", true).order("nome"),
    supabase.from("entregas").select("id, grupo_id, etapa_id, analises(status, conceito)").eq("org_id", empresa.id).eq("status", "recebida"),
  ]);
  const base = `/app/${slug}/entregas`;
  const hoje = hojeISO();
  const entregaDe = new Map(((data ?? []) as unknown as Linha[]).map((e) => [`${e.grupo_id}:${e.etapa_id}`, e]));

  const equipes = (grupos ?? []).map((g) => {
    const celulas: Celula[] = etapas.map((et) => {
      const e = entregaDe.get(`${g.id}:${et.id}`);
      if (!e) return et.recebe_ate && hoje > et.recebe_ate ? { tipo: "nao-entregou" } : { tipo: "aguardando" };
      const a = e.analises;
      if (a?.status === "aprovada" && a.conceito) return { tipo: "aprovado", conceito: a.conceito, entregaId: e.id };
      if (a?.status === "pronta") return { tipo: "revisar", conceito: a.conceito, entregaId: e.id };
      return { tipo: "sem-analise", entregaId: e.id };
    });
    return { g, celulas, ev: evolucaoDaEquipe(celulas) };
  });
  const contar = (f: (x: (typeof equipes)[number]) => boolean) => equipes.filter(f).length;
  const visiveis = equipes.filter((x) =>
    filtro === "atencao" ? x.ev.atencao : filtro === "caiu" ? x.ev.tendencia === "caiu" : filtro === "melhorou" ? x.ev.tendencia === "melhorou" : true,
  );
  const abrev = (n: number) => `${v.etapa.slice(0, 1).toUpperCase()}${n}`;

  return (
    <section className="flex flex-col gap-4">
      <Link href={base} className="text-sm font-semibold text-marca-forte hover:underline">
        ← Painel
      </Link>
      <div>
        <h2 className="text-lg font-semibold">Evolução</h2>
        <p className="text-sm text-suave">
          O conceito aprovado em cada {minusc(v.etapa)}, lado a lado. A seta compara os dois últimos conceitos aprovados.
        </p>
      </div>

      {!etapas.length || !equipes.length ? (
        <Vazio>Cadastre {minusc(v.etapas)} e {minusc(v.grupos)} para acompanhar a evolução.</Vazio>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:max-w-2xl sm:grid-cols-4">
            <Numero rotulo="Melhoraram" valor={contar((x) => x.ev.tendencia === "melhorou")} classe="border-ok/25 bg-ok-fundo text-ok" />
            <Numero rotulo="Mantiveram" valor={contar((x) => x.ev.tendencia === "manteve")} classe="border-borda bg-cartao" />
            <Numero rotulo="Caíram" valor={contar((x) => x.ev.tendencia === "caiu")} classe="border-ruim/25 bg-ruim-fundo text-ruim" />
            <Numero rotulo="Precisam de atenção" valor={contar((x) => x.ev.atencao)} classe="border-alerta/25 bg-alerta-fundo text-alerta" />
          </dl>

          <nav aria-label="Filtrar" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex min-w-max gap-1.5">
              {(Object.keys(FILTROS) as Filtro[]).map((f) => (
                <li key={f}>
                  <Link
                    href={f === "todas" ? `${base}/evolucao` : `${base}/evolucao?ver=${f}`}
                    aria-current={f === filtro ? "true" : undefined}
                    className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-semibold ${
                      f === filtro ? "border-texto bg-texto text-fundo" : "border-borda bg-cartao text-suave hover:text-texto"
                    }`}
                  >
                    {FILTROS[f]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {!visiveis.length ? (
            <Vazio>Nenhuma neste filtro.</Vazio>
          ) : (
            <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {visiveis.map(({ g, celulas, ev }) => (
                <li key={g.id} className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="break-words font-semibold">{g.nome}</span>
                      {g.tema ? <span className="break-words text-[13px] text-suave">{g.tema}</span> : null}
                    </div>
                    <Pilula className={ESTILO_TENDENCIA[ev.tendencia].classe}>
                      <span aria-hidden className="mr-1">
                        {ESTILO_TENDENCIA[ev.tendencia].seta}
                      </span>
                      {ROTULO_TENDENCIA[ev.tendencia]}
                    </Pilula>
                  </div>
                  <ol aria-label={`Conceitos de ${g.nome} por ${minusc(v.etapa)}`} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                    {celulas.map((c, i) => {
                      const et = etapas[i];
                      const conteudo = <Caixinha celula={c} rotulo={abrev(et.numero)} titulo={`${v.etapa} ${et.numero} · ${et.titulo}`} />;
                      return (
                        <li key={et.id} className="shrink-0">
                          {"entregaId" in c ? (
                            <Link href={`${base}/${c.entregaId}`} className="block rounded-lg hover:ring-2 hover:ring-marca/40">
                              {conteudo}
                            </Link>
                          ) : (
                            conteudo
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  {ev.atencao ? <p className="text-[13px] font-medium text-alerta">Atenção: {ev.motivos.join("; ")}.</p> : null}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-suave">
            Conceito com borda tracejada: ainda para revisar (sugestão da IA). “—”: entregue e sem análise. “×”: não entregou. Em branco: ainda
            dentro do prazo.
          </p>
        </>
      )}
    </section>
  );
}

function Caixinha({ celula, rotulo, titulo }: { celula: Celula; rotulo: string; titulo: string }) {
  let texto = "";
  let classe = "border border-borda bg-cartao text-suave";
  let descricao = "";
  if (celula.tipo === "aprovado") {
    const e = ESTILO_CONCEITO[celula.conceito] ?? ESTILO_CONCEITO.PENDENTE;
    texto = celula.conceito;
    classe = `${e.fundo} ${e.texto}`;
    descricao = `aprovado ${celula.conceito}`;
  } else if (celula.tipo === "revisar") {
    const e = ESTILO_CONCEITO[celula.conceito ?? ""] ?? ESTILO_CONCEITO.PENDENTE;
    texto = celula.conceito ?? "?";
    classe = `border border-dashed ${e.borda} ${e.texto} bg-cartao`;
    descricao = `para revisar, IA sugeriu ${celula.conceito ?? "?"}`;
  } else if (celula.tipo === "sem-analise") {
    texto = "—";
    descricao = "entregue, sem análise";
  } else if (celula.tipo === "nao-entregou") {
    texto = "×";
    classe = "border border-ruim/30 bg-ruim-fundo text-ruim";
    descricao = "não entregou";
  } else {
    descricao = "dentro do prazo";
  }
  return (
    <span title={titulo} className="flex w-[5.25rem] flex-col items-center gap-1 py-0.5">
      <span className="text-[11px] font-semibold text-suave">{rotulo}</span>
      <span className={`flex h-8 w-full items-center justify-center rounded-lg text-[11px] font-bold tracking-wide ${classe}`}>
        {texto}
        <span className="sr-only">
          {" "}
          ({titulo}: {descricao})
        </span>
      </span>
    </span>
  );
}

function Numero({ rotulo, valor, classe }: { rotulo: string; valor: number; classe: string }) {
  return (
    <div className={`flex flex-col-reverse gap-0.5 rounded-xl border px-3 py-2.5 ${classe}`}>
      <dt className="text-xs leading-tight opacity-90">{rotulo}</dt>
      <dd className="text-xl font-bold">{valor}</dd>
    </div>
  );
}

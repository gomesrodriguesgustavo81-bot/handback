import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario } from "@/lib/nomes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/textos";
import { turmasDaEmpresa } from "@/lib/turma";
import { ConviteAvisos } from "./convite-avisos";

export const metadata: Metadata = { title: "Início" };

type Cor = "marca" | "alerta" | "neutro" | "erro";
/** Um tipo de tarefa (ex.: "3 devolutivas para aprovar"), com cada ciclo em que ela aparece. */
type Grupo = {
  chave: string;
  total: number;
  titulo: string;
  acao: string;
  cor: Cor;
  lugares: { chave: string; turma: string | null; rotulo: string; n: number; href: string }[];
};

const CORES: Record<Cor, string> = {
  marca: "bg-marca-clara text-marca-forte",
  alerta: "bg-alerta-fundo text-alerta",
  neutro: "bg-neutro-fundo text-neutro",
  erro: "bg-erro-fundo text-erro",
};
const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function maisDias(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

/**
 * Início: o que o professor tem que fazer agora, em todas as turmas, e o
 * que vence esta semana. Cada item leva direto para onde resolver.
 */
export default async function Inicio({ params, searchParams }: PageProps<"/app/[slug]/inicio">) {
  const { slug } = await params;
  const { turma: filtro } = await searchParams;
  const { empresa, podeAvaliar, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) redirect(`/app/${slug}/etapas`);
  if (!empresa.configurada && podeGerir) redirect(`/app/${slug}/comecar`);
  const v = completarVocabulario(empresa.vocabulario);
  const turmas = (await turmasDaEmpresa(empresa.id)).filter((t) => !t.arquivada);
  const escolhida = typeof filtro === "string" ? turmas.find((t) => t.id === filtro) : undefined;
  const hoje = hojeISO();
  const fimDaSemana = maisDias(hoje, 6);
  const supabase = await criarClienteServidor();
  const [{ data: entregas }, { data: pendentes }, { data: prazos }, { data: gmail }, { data: google }, { data: moodle }] = await Promise.all([
    supabase
      .from("entregas")
      .select("id, etapas!inner(id, turma_id, numero, titulo), analises(status, enviada_em, moodle_enviada_em, classroom_enviada_em)")
      .eq("org_id", empresa.id)
      .eq("status", "recebida")
      .limit(5000),
    supabase.from("classroom_pendentes").select("etapas!inner(id, turma_id, numero, titulo)").eq("org_id", empresa.id).limit(5000),
    supabase
      .from("etapas")
      .select("id, numero, titulo, recebe_ate, turma_id")
      .eq("org_id", empresa.id)
      .gte("recebe_ate", hoje)
      .lte("recebe_ate", fimDaSemana)
      .order("recebe_ate"),
    supabase.from("contas_gmail").select("invalida").maybeSingle(),
    supabase.from("conexoes_google").select("servico, invalida"),
    supabase.from("contas_moodle").select("invalida").eq("org_id", empresa.id),
  ]);
  const { data: emails } = await supabase.from("emails_recebidos").select("turma_id").eq("org_id", empresa.id).eq("status", "confirmar").limit(2000);

  const nomeDa = new Map(turmas.map((t) => [t.id, t]));
  const origem = (id: string) => {
    const t = nomeDa.get(id);
    return t ? `${t.nome}${t.classroom_curso ? " · Classroom" : t.moodle_conta ? " · Moodle" : ""}` : "";
  };
  const ir = (turma: string, para: string) => `/app/${slug}/ir?turma=${turma}&para=${encodeURIComponent(`/app/${slug}/${para}`)}`;

  // Contas por ciclo (cada item leva direto para o ciclo certo).
  type Ciclo = { id: string; turma_id: string; numero: number; titulo: string };
  type Conta = { ciclo: Ciclo; semAnalise: number; revisar: number; enviar: number; erro: number; esperando: number };
  const porCiclo = new Map<string, Conta>();
  const conta = (c: Ciclo) => porCiclo.get(c.id) ?? (porCiclo.set(c.id, { ciclo: c, semAnalise: 0, revisar: 0, enviar: 0, erro: 0, esperando: 0 }), porCiclo.get(c.id)!);
  for (const e of entregas ?? []) {
    const ciclo = e.etapas as unknown as Ciclo;
    if (!nomeDa.has(ciclo.turma_id)) continue;
    const bruto = e.analises as unknown;
    const a = (Array.isArray(bruto) ? bruto[0] : bruto) as { status: string; enviada_em: string | null; moodle_enviada_em: string | null; classroom_enviada_em: string | null } | null;
    const c = conta(ciclo);
    if (!a) c.semAnalise++;
    else if (a.status === "pronta") c.revisar++;
    else if (a.status === "erro") c.erro++;
    else if (a.status === "aprovada" && !a.enviada_em && !a.moodle_enviada_em && !a.classroom_enviada_em) c.enviar++;
  }
  for (const p of pendentes ?? []) {
    const ciclo = p.etapas as unknown as Ciclo;
    if (nomeDa.has(ciclo.turma_id)) conta(ciclo).esperando++;
  }

  const contasComProblema = [
    ...(gmail?.invalida ? ["Gmail"] : []),
    ...(google ?? []).filter((g) => g.invalida).map((g) => ({ agenda: "Google Agenda", drive: "Google Drive", classroom: "Google Classroom" })[g.servico as string] ?? "Google"),
    ...((moodle ?? []).some((m) => m.invalida) ? ["Moodle"] : []),
  ];
  const ordenados = [...porCiclo.values()].sort((x, y) => origem(x.ciclo.turma_id).localeCompare(origem(y.ciclo.turma_id)) || x.ciclo.numero - y.ciclo.numero);
  const daTurma = (turma: string | null) => !escolhida || turma === null || turma === escolhida.id;
  const lugar = (c: Conta, n: number, para: string) => ({
    chave: c.ciclo.id,
    turma: c.ciclo.turma_id,
    rotulo: `${v.etapa} ${c.ciclo.numero}${turmas.length > 1 && !escolhida ? ` · ${nomeDa.get(c.ciclo.turma_id)?.nome ?? ""}` : ""}`,
    n,
    href: ir(c.ciclo.turma_id, para),
  });
  // Agrupa por tipo de tarefa: uma linha só para "3 devolutivas para aprovar", com os ciclos embaixo.
  const tipo = (chave: string, cor: Cor, acao: string, um: string, varios: string, conta: (c: Conta) => number, para: (c: Conta) => string): Grupo | null => {
    const lugares = ordenados.filter((c) => conta(c) > 0 && daTurma(c.ciclo.turma_id)).map((c) => lugar(c, conta(c), para(c)));
    const total = lugares.reduce((n, l) => n + l.n, 0);
    return total ? { chave, total, titulo: `${total} ${plural(total, um, varios)}`, acao, cor, lugares } : null;
  };
  const porTurma = new Map<string, number>();
  for (const e of emails ?? []) if (e.turma_id && nomeDa.has(e.turma_id) && daTurma(e.turma_id)) porTurma.set(e.turma_id, (porTurma.get(e.turma_id) ?? 0) + 1);
  const totalEmails = [...porTurma.values()].reduce((a, b) => a + b, 0);
  const grupos = [
    contasComProblema.length
      ? {
          chave: "contas",
          total: contasComProblema.length,
          titulo: `${contasComProblema.join(", ")} ${contasComProblema.length === 1 ? "pediu" : "pediram"} para conectar de novo`,
          acao: "Conectar",
          cor: "erro" as Cor,
          lugares: [{ chave: "contas", turma: null, rotulo: "Contas conectadas", n: contasComProblema.length, href: `/app/${slug}/contas` }],
        }
      : null,
    tipo("analisar", "marca", "Analisar", "entrega para analisar", "entregas para analisar", (c) => c.semAnalise, (c) => `etapas/${c.ciclo.id}`),
    tipo("revisar", "marca", "Revisar", "devolutiva para aprovar", "devolutivas para aprovar", (c) => c.revisar, (c) => `entregas/revisar?etapa=${c.ciclo.id}`),
    tipo("enviar", "marca", "Enviar", "devolutiva aprovada sem enviar", "devolutivas aprovadas sem enviar", (c) => c.enviar, (c) => `etapas/${c.ciclo.id}/enviar`),
    tipo("erro", "erro", "Ver", "análise falhou", "análises falharam", (c) => c.erro, (c) => `etapas/${c.ciclo.id}`),
    tipo("esperando", "alerta", "Trazer", "arquivo esperando no Drive dos alunos", "arquivos esperando no Drive dos alunos", (c) => c.esperando, (c) => `etapas/${c.ciclo.id}`),
    totalEmails
      ? {
          chave: "emails",
          total: totalEmails,
          titulo: `${totalEmails} ${plural(totalEmails, "e-mail para conferir", "e-mails para conferir")}`,
          acao: "Conferir",
          cor: "alerta" as Cor,
          lugares: [...porTurma.entries()].map(([t, n]) => ({ chave: t, turma: t, rotulo: nomeDa.get(t)?.nome ?? "", n, href: ir(t, "entregas/caixa") })),
        }
      : null,
  ].filter((g): g is Grupo => Boolean(g));

  const prazosVisiveis = (prazos ?? []).filter((p) => nomeDa.has(p.turma_id) && (!escolhida || p.turma_id === escolhida.id));
  const deHoje = prazosVisiveis.filter((p) => p.recebe_ate === hoje);
  const proximos = prazosVisiveis.filter((p) => p.recebe_ate !== hoje);
  const dias = Array.from({ length: 7 }, (_, i) => maisDias(hoje, i));
  const comPrazo = new Set(prazosVisiveis.map((p) => String(p.recebe_ate)));
  const chip = (ativo: boolean) =>
    `toque inline-flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-semibold ${ativo ? "bg-marca text-sobre-marca" : "bg-cartao text-texto shadow-cartao"}`;
  const [primeiro, ...resto] = grupos;
  const etiqueta = (l: Grupo["lugares"][number], forte = false) => (
    <Link
      key={l.chave}
      href={l.href}
      transitionTypes={["nav-forward"]}
      className={`toque inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold ${forte ? "bg-fundo text-texto hover:bg-marca-clara" : "bg-fundo text-suave hover:text-texto"}`}
    >
      {l.rotulo}
      {l.n > 1 || forte ? <span className="text-suave">· {l.n}</span> : null}
    </Link>
  );

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight sm:text-3xl">
        {grupos.length ? (
          <>
            Você tem{" "}
            <span className="text-marca">
              {grupos.length} {plural(grupos.length, "coisa", "coisas")}
            </span>{" "}
            para fazer
          </>
        ) : (
          <>Tudo em dia{escolhida ? " nesta turma" : ""} 🎉</>
        )}
      </h1>
      {turmas.length > 1 ? (
        <nav aria-label="Filtrar por turma" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Link href={`/app/${slug}/inicio`} scroll={false} className={`${chip(!escolhida)} shrink-0`} aria-current={!escolhida ? "page" : undefined}>
            Todas
          </Link>
          {turmas.map((t) => (
            <Link key={t.id} href={`/app/${slug}/inicio?turma=${t.id}`} scroll={false} className={`${chip(escolhida?.id === t.id)} shrink-0`} aria-current={escolhida?.id === t.id ? "page" : undefined}>
              {t.nome}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div className="flex flex-col gap-3">
          {primeiro ? (
            <ul aria-label="Para fazer" className="flex flex-col gap-2.5">
              {/* O primeiro tipo de tarefa ganha destaque: é o próximo passo. */}
              <li className="flex flex-col gap-4 rounded-[22px] bg-cartao p-5 shadow-cartao ring-1 ring-borda/60">
                <span className="text-[11px] font-bold uppercase tracking-wider text-marca">Próximo passo</span>
                <Link href={primeiro.lugares[0].href} transitionTypes={["nav-forward"]} className="text-[22px] font-extrabold leading-snug hover:underline">
                  {primeiro.titulo}
                </Link>
                {primeiro.lugares.length > 1 ? <span className="flex flex-wrap gap-1.5">{primeiro.lugares.map((l) => etiqueta(l, true))}</span> : <span className="text-sm text-suave">{primeiro.lugares[0].rotulo}</span>}
                <Link
                  href={primeiro.lugares[0].href}
                  transitionTypes={["nav-forward"]}
                  className={`toque flex min-h-12 items-center justify-center rounded-2xl px-6 text-[15px] font-bold lg:self-start ${primeiro.cor === "erro" ? "bg-erro text-white" : "bg-marca text-sobre-marca"}`}
                >
                  {primeiro.acao} agora
                </Link>
              </li>
              {resto.map((g) => (
                <li key={g.chave} className="flex flex-col gap-2 rounded-[18px] bg-cartao px-4 py-3 shadow-cartao ring-1 ring-borda/60">
                  <span className="flex items-center gap-3">
                    <span className={`flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl px-1.5 text-sm font-extrabold ${CORES[g.cor]}`}>{g.total}</span>
                    <Link href={g.lugares[0].href} transitionTypes={["nav-forward"]} className="min-w-0 flex-1 font-semibold leading-snug hover:underline">
                      {g.titulo.replace(/^\d+\s/, "")}
                    </Link>
                    <Link href={g.lugares[0].href} transitionTypes={["nav-forward"]} className="shrink-0 text-sm font-semibold text-marca">
                      {g.acao} ›
                    </Link>
                  </span>
                  {g.lugares.length > 1 ? <span className="flex flex-wrap gap-1.5 pl-[3.25rem]">{g.lugares.map((l) => etiqueta(l))}</span> : <span className="pl-[3.25rem] text-xs text-suave">{g.lugares[0].rotulo}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-[22px] bg-cartao p-6 text-center text-suave shadow-cartao">Nada esperando por você agora. Quando chegar algo, aparece aqui.</p>
          )}
          <ConviteAvisos />
        </div>

        <aside className="flex flex-col gap-3">
          {deHoje.length ? (
            <section aria-label="Hoje" className="flex flex-col gap-2 rounded-[20px] bg-cartao p-4 shadow-cartao ring-1 ring-borda/60">
              <b className="text-[15px]">Hoje</b>
              <span className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-erro-fundo font-extrabold text-erro">{deHoje.length}</span>
                <span className="flex min-w-0 flex-col">
                  <b className="text-sm">{deHoje.length === 1 ? "prazo vence hoje" : "prazos vencem hoje"}</b>
                  <span className="text-xs text-suave">
                    {deHoje.map((p) => `${v.etapa} ${p.numero}`).join(", ")}
                    {turmas.length > 1 && !escolhida ? ` · ${[...new Set(deHoje.map((p) => nomeDa.get(p.turma_id)?.nome))].join(", ")}` : ""}
                  </span>
                </span>
              </span>
            </section>
          ) : null}
          <section aria-label="Esta semana" className="flex flex-col gap-3 rounded-[20px] bg-cartao p-4 shadow-cartao ring-1 ring-borda/60">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold">Esta semana</h2>
              <Link href={`/app/${slug}/calendario`} className="text-sm font-semibold text-marca hover:underline">
                Calendário ›
              </Link>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {dias.map((d, i) => (
                <span key={d} className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] ${i === 0 ? "bg-marca text-sobre-marca" : "text-suave"}`}>
                  {SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]}
                  <b className={`text-[14px] ${i === 0 ? "" : "text-texto"}`}>{Number(d.slice(8))}</b>
                  <span aria-hidden className={`size-1.5 rounded-full ${comPrazo.has(d) ? (i === 0 ? "bg-sobre-marca" : "bg-marca") : "bg-transparent"}`} />
                </span>
              ))}
            </div>
            {proximos.length ? (
              <ul className="flex flex-col gap-1 text-[13px]">
                {proximos.slice(0, 4).map((p) => (
                  <li key={p.id}>
                    <Link href={ir(p.turma_id, `etapas/${p.id}`)} className="text-suave hover:underline">
                      <b className="text-texto">
                        {SEMANA[new Date(`${p.recebe_ate}T12:00:00Z`).getUTCDay()]} {Number(String(p.recebe_ate).slice(8))}
                      </b>{" "}
                      · {v.etapa} {p.numero} · <span className="text-texto">{p.titulo}</span>
                    </Link>
                  </li>
                ))}
                {proximos.length > 4 ? <li className="text-suave">e mais {proximos.length - 4} no calendário</li> : null}
              </ul>
            ) : (
              <p className="text-[13px] text-suave">{deHoje.length ? "Nenhum outro prazo nos próximos dias." : "Nenhum prazo nos próximos 7 dias."}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

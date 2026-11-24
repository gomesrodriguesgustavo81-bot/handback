import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario } from "@/lib/nomes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/textos";
import { turmasDaEmpresa } from "@/lib/turma";

export const metadata: Metadata = { title: "Início" };

type Cor = "marca" | "alerta" | "neutro" | "erro";
type Item = { chave: string; turma: string | null; numero: string; titulo: string; onde: string; acao: string; href: string; cor: Cor };

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

  const itens: Item[] = [];
  const contasComProblema = [
    ...(gmail?.invalida ? ["Gmail"] : []),
    ...(google ?? []).filter((g) => g.invalida).map((g) => ({ agenda: "Google Agenda", drive: "Google Drive", classroom: "Google Classroom" })[g.servico as string] ?? "Google"),
    ...((moodle ?? []).some((m) => m.invalida) ? ["Moodle"] : []),
  ];
  for (const nome of contasComProblema) {
    itens.push({ chave: `conta-${nome}`, turma: null, numero: "!", titulo: `${nome} pediu para conectar de novo`, onde: "Contas conectadas", acao: "Conectar", href: `/app/${slug}/contas`, cor: "erro" });
  }
  const ordenados = [...porCiclo.values()].sort((x, y) => origem(x.ciclo.turma_id).localeCompare(origem(y.ciclo.turma_id)) || x.ciclo.numero - y.ciclo.numero);
  for (const c of ordenados) {
    const { id, turma_id: turma, numero } = c.ciclo;
    const onde = `${origem(turma)} · ${v.etapa} ${numero}`;
    if (c.semAnalise)
      itens.push({ chave: `${id}-a`, turma, numero: String(c.semAnalise), titulo: `${plural(c.semAnalise, "entrega", "entregas")} para analisar`, onde, acao: "Analisar", href: ir(turma, `entregas?etapa=${id}`), cor: "marca" });
    if (c.revisar)
      itens.push({ chave: `${id}-r`, turma, numero: String(c.revisar), titulo: `${plural(c.revisar, "devolutiva", "devolutivas")} para aprovar`, onde, acao: "Revisar", href: ir(turma, `entregas/revisar?etapa=${id}`), cor: "marca" });
    if (c.enviar)
      itens.push({ chave: `${id}-e`, turma, numero: String(c.enviar), titulo: `${plural(c.enviar, "devolutiva aprovada", "devolutivas aprovadas")} sem enviar`, onde, acao: "Enviar", href: ir(turma, `etapas/${id}/enviar`), cor: "marca" });
    if (c.erro)
      itens.push({ chave: `${id}-x`, turma, numero: String(c.erro), titulo: `${plural(c.erro, "análise falhou", "análises falharam")}`, onde, acao: "Ver", href: ir(turma, `entregas?etapa=${id}`), cor: "erro" });
    if (c.esperando)
      itens.push({ chave: `${id}-p`, turma, numero: String(c.esperando), titulo: `${plural(c.esperando, "arquivo esperando", "arquivos esperando")} no Drive dos alunos`, onde, acao: "Trazer", href: ir(turma, `etapas/${id}`), cor: "alerta" });
  }
  const visiveis = itens.filter((i) => !escolhida || i.turma === null || i.turma === escolhida.id);
  const prazosVisiveis = (prazos ?? []).filter((p) => nomeDa.has(p.turma_id) && (!escolhida || p.turma_id === escolhida.id));
  const dias = Array.from({ length: 7 }, (_, i) => maisDias(hoje, i));
  const comPrazo = new Set(prazosVisiveis.map((p) => String(p.recebe_ate)));
  const chip = (ativo: boolean) =>
    `toque inline-flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-semibold ${ativo ? "bg-marca text-sobre-marca" : "bg-cartao text-texto shadow-cartao"}`;
  const [primeiro, ...resto] = visiveis;

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight sm:text-3xl">
        {visiveis.length ? (
          <>
            Você tem{" "}
            <span className="text-marca">
              {visiveis.length} {plural(visiveis.length, "coisa", "coisas")}
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

      {primeiro ? (
        <ul aria-label="Para fazer" className="flex flex-col gap-2.5">
          {/* O primeiro da fila ganha destaque: é o próximo passo. */}
          <li>
            <Link
              href={primeiro.href}
              transitionTypes={["nav-forward"]}
              className="toque flex flex-col gap-4 rounded-[22px] bg-cartao p-4 shadow-cartao ring-1 ring-borda/60 hover:ring-marca"
            >
              <span className="flex items-center gap-3">
                <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold ${CORES[primeiro.cor]}`}>{primeiro.numero}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-marca">Próximo passo</span>
                  <span className="text-[17px] font-bold leading-snug">{primeiro.numero === "!" ? primeiro.titulo : `${primeiro.numero} ${primeiro.titulo}`}</span>
                  <span className="truncate text-[13px] text-suave">{primeiro.onde}</span>
                </span>
              </span>
              <span className={`flex min-h-12 items-center justify-center rounded-2xl text-[15px] font-bold ${primeiro.cor === "erro" ? "bg-erro text-white" : "bg-marca text-sobre-marca"}`}>
                {primeiro.acao} agora
              </span>
            </Link>
          </li>
          {resto.map((i) => (
            <li key={i.chave}>
              <Link href={i.href} transitionTypes={["nav-forward"]} className="toque flex min-h-16 items-center gap-3 rounded-[18px] bg-cartao px-3.5 py-2.5 shadow-cartao ring-1 ring-borda/60 hover:ring-marca">
                <span className={`flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl px-1.5 text-sm font-extrabold ${CORES[i.cor]}`}>{i.numero}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold leading-snug">{i.titulo}</span>
                  <span className="truncate text-xs text-suave">{i.onde}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-marca">{i.acao} ›</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[22px] bg-cartao p-6 text-center text-suave shadow-cartao">Nada esperando por você agora. Quando chegar algo, aparece aqui.</p>
      )}

      <section aria-label="Esta semana" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold">Esta semana</h2>
          <Link href={`/app/${slug}/calendario`} className="text-sm font-semibold text-marca hover:underline">
            Calendário ›
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {dias.map((d, i) => (
            <span
              key={d}
              className={`flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] ${i === 0 ? "bg-marca text-sobre-marca" : "bg-cartao text-suave shadow-cartao"} ${comPrazo.has(d) && i > 0 ? "shadow-[inset_0_-3px_0_var(--erro)]" : ""}`}
            >
              {SEMANA[new Date(`${d}T12:00:00Z`).getUTCDay()]}
              <b className={`text-[15px] ${i === 0 ? "" : "text-texto"}`}>{Number(d.slice(8))}</b>
              {comPrazo.has(d) && i === 0 ? <span aria-hidden className="size-1.5 rounded-full bg-sobre-marca" /> : null}
            </span>
          ))}
        </div>
        {prazosVisiveis.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {prazosVisiveis.map((p) => (
              <li key={p.id}>
                <Link href={ir(p.turma_id, `etapas/${p.id}`)} className="text-suave hover:underline">
                  <b className="text-erro">
                    {SEMANA[new Date(`${p.recebe_ate}T12:00:00Z`).getUTCDay()]} {Number(String(p.recebe_ate).slice(8))}
                  </b>{" "}
                  · prazo {v.etapa} {p.numero} · <span className="text-texto">{p.titulo}</span> · {nomeDa.get(p.turma_id)?.nome}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-suave">Nenhum prazo nos próximos 7 dias.</p>
        )}
      </section>
    </div>
  );
}

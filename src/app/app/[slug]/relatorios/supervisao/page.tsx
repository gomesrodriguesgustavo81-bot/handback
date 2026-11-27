import type { Metadata } from "next";
import Link from "next/link";
import { AcoesSupervisao } from "@/components/acoes-supervisao";
import { ESTILO_CONCEITO } from "@/components/conceito";
import { Vazio } from "@/components/ui";
import { completarVocabulario } from "@/lib/nomes";
import { resumoSupervisao } from "@/lib/supervisao";
import { dataHoraBR } from "@/lib/textos";
import { carregarSupervisao } from "./dados";

export const metadata: Metadata = { title: "Registro de supervisão" };

const FILTROS = { todas: "Todas", mudou: "Você mudou", alerta: "Com alerta" } as const;
type Filtro = keyof typeof FILTROS;

function Pilula({ c }: { c: string | null }) {
  const e = ESTILO_CONCEITO[c ?? ""] ?? ESTILO_CONCEITO.PENDENTE;
  return <b className={`rounded-full px-2.5 py-0.5 text-xs ${e.fundo} ${e.texto}`}>{c ?? "—"}</b>;
}

export default async function RegistroDeSupervisao({ params, searchParams }: PageProps<"/app/[slug]/relatorios/supervisao">) {
  const { slug } = await params;
  const { ver } = await searchParams;
  const filtro: Filtro = typeof ver === "string" && ver in FILTROS ? (ver as Filtro) : "todas";
  const { empresa, turma, linhas } = await carregarSupervisao(slug);
  const vc = completarVocabulario(empresa.vocabulario);
  const r = resumoSupervisao(linhas);
  const visiveis = linhas.filter((l) => (filtro === "mudou" ? l.mudou : filtro === "alerta" ? l.alertas > 0 : true));
  const base = `/app/${slug}/relatorios/supervisao`;

  return (
    <section className="flex flex-col gap-4 sm:max-w-2xl">
      <div>
        <Link href={`/app/${slug}/relatorios`} className="inline-flex min-h-11 items-center text-sm font-semibold text-marca-forte hover:underline print:hidden">
          ← Relatórios
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Registro de supervisão</h1>
        <p className="text-[13px] leading-relaxed text-suave">
          {turma.nome}. Mostra, {vc.etapa.toLowerCase()} por {vc.etapa.toLowerCase()}, o que a IA sugeriu e o que você decidiu. A decisão é sua; este registro é a prova.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Numero rotulo="Aprovadas por você" valor={r.aprovadas} classe="border-borda bg-cartao" />
        <Numero rotulo="Você mudou" valor={r.mudou} classe="border-alerta/25 bg-alerta-fundo text-alerta" />
        <Numero rotulo="Aceitou a sugestão" valor={r.aceitou} classe="border-ok/25 bg-ok-fundo text-ok" />
        <Numero rotulo="Falta revisar" valor={r.aguardando} classe="border-borda bg-cartao" />
      </dl>

      <nav aria-label="Filtrar" className="flex flex-wrap gap-1.5 print:hidden">
        {(Object.keys(FILTROS) as Filtro[]).map((f) => (
          <Link
            key={f}
            href={f === "todas" ? base : `${base}?ver=${f}`}
            aria-current={f === filtro ? "true" : undefined}
            className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-[13px] font-semibold ${f === filtro ? "border-texto bg-texto text-fundo" : "border-borda bg-cartao text-suave hover:text-texto"}`}
          >
            {FILTROS[f]}
          </Link>
        ))}
      </nav>

      {!visiveis.length ? (
        <Vazio>{linhas.length ? "Nada neste filtro." : "Ainda não há análises nesta turma."}</Vazio>
      ) : (
        <ul className="flex flex-col gap-2">
          {visiveis.map((l, i) => (
            <li key={i} className="flex flex-col gap-1.5 break-inside-avoid rounded-2xl border border-borda bg-cartao px-4 py-3 text-sm">
              <span className="flex justify-between gap-2">
                <b className="min-w-0 break-words">
                  {l.grupo} · {vc.etapa} {l.etapaNumero}
                </b>
                <span className="shrink-0 text-xs text-suave">{l.aprovadaEm ? dataHoraBR(l.aprovadaEm) : "falta revisar"}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2 text-[13px]">
                IA sugeriu <Pilula c={l.conceitoIa} />
                {l.situacao === "aprovada" ? (
                  <>
                    <span aria-hidden>→</span>Você decidiu <Pilula c={l.conceitoFinal} />
                    {!l.mudou && l.conceitoIa ? <span className="text-suave">(manteve)</span> : null}
                  </>
                ) : null}
              </span>
              {l.motivo ? (
                <span className="text-[13px] leading-relaxed text-texto">
                  <b>Motivo:</b> {l.motivo}
                </span>
              ) : null}
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-suave">
                {l.situacao === "aprovada" ? <span>Aprovada por {l.aprovadaPor}</span> : null}
                {l.situacao === "aprovada" ? <span>{l.escolheu ? "Conceito escolhido por você" : "Aceitou a sugestão"}</span> : null}
                {l.alertas ? <span className="font-semibold text-alerta">{l.alertas} {l.alertas === 1 ? "alerta" : "alertas"} na entrega</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Guardar" className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4 print:hidden">
        <h2 className="text-[15px] font-bold">Guardar este registro</h2>
        <AcoesSupervisao href={`${base}/baixar`} />
        <p className="text-xs leading-relaxed text-suave">
          Tem os nomes dos alunos: guarde com cuidado. Serve para mostrar à coordenação ou a uma banca que as decisões foram suas, e para responder se um aluno pedir revisão.
        </p>
      </section>
    </section>
  );
}

function Numero({ rotulo, valor, classe }: { rotulo: string; valor: number; classe: string }) {
  return (
    <div className={`flex flex-col-reverse gap-0.5 rounded-2xl border px-3 py-2.5 ${classe}`}>
      <dt className="text-xs opacity-90">{rotulo}</dt>
      <dd className="text-2xl font-extrabold">{valor}</dd>
    </div>
  );
}

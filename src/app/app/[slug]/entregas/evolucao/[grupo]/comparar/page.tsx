import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ESTILO_CONCEITO, IconeItem, type StatusItem } from "@/components/conceito";
import { compararEntregas, podeCompararEntregas, pontosComparaveis } from "@/lib/linha-do-tempo";
import { carregarLinhaDoTempo } from "@/lib/linha-do-tempo-dados";

export const metadata: Metadata = { title: "Comparar entregas" };

const SELECT = "min-h-11 w-full rounded-xl border border-borda bg-cartao px-2.5 text-sm font-semibold";

export default async function CompararEntregas({ params, searchParams }: PageProps<"/app/[slug]/entregas/evolucao/[grupo]/comparar">) {
  const { slug, grupo: grupoId } = await params;
  const { antes: qa, depois: qd } = await searchParams;
  const { grupo, pontos, base } = await carregarLinhaDoTempo(slug, grupoId);
  // Sem 2 entregas analisadas não há o que comparar: volta para a linha do tempo.
  if (!podeCompararEntregas(pontos)) notFound();
  const lista = pontosComparaveis(pontos);
  const pelaId = (v: unknown) => lista.find((p) => p.etapaId === v);
  const depois = pelaId(qd) ?? lista.at(-1)!;
  const antes = (pelaId(qa) && pelaId(qa) !== depois ? pelaId(qa) : undefined) ?? lista.filter((p) => p.numero < depois.numero).at(-1) ?? lista.find((p) => p !== depois)!;
  const [a, d] = antes.numero <= depois.numero ? [antes, depois] : [depois, antes];
  const c = compararEntregas(a, d);
  const rotulo = (p: (typeof lista)[number]) => `Entrega ${p.numero} · ${p.titulo}`;
  const aviso = a.situacao !== "aprovada" || d.situacao !== "aprovada";
  const e = (x: string | null) => ESTILO_CONCEITO[x ?? ""] ?? ESTILO_CONCEITO.PENDENTE;
  const rotuloStatus = (s: string) => (s === "PARCIAL" ? "Entregue só em parte" : s === "ENTREGUE" ? "Entregue" : "Não entregue");

  return (
    <section className="flex flex-col gap-4 sm:max-w-2xl">
      <Link href={base} className="inline-flex min-h-11 items-center text-sm font-semibold text-marca-forte hover:underline">
        ← {grupo.nome}
      </Link>
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Comparar entregas</h2>
        <p className="text-[13px] text-suave">Opcional: use quando quiser ver como a mesma pessoa mudou de uma entrega para outra.</p>
      </div>

      <form method="get" className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-suave">
          Antes
          <select name="antes" defaultValue={a.etapaId} className={SELECT}>
            {lista.map((p) => (
              <option key={p.etapaId} value={p.etapaId}>{rotulo(p)}</option>
            ))}
          </select>
        </label>
        <span aria-hidden className="flex min-h-11 items-center font-bold text-suave">×</span>
        <label className="flex flex-col gap-1 text-xs font-semibold text-suave">
          Depois
          <select name="depois" defaultValue={d.etapaId} className={SELECT}>
            {lista.map((p) => (
              <option key={p.etapaId} value={p.etapaId}>{rotulo(p)}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="col-span-3 min-h-11 rounded-xl bg-marca px-4 text-sm font-bold text-sobre-marca">
          Comparar
        </button>
      </form>

      <section aria-label="Resumo" className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
        <div className="flex items-center justify-center gap-2.5">
          <span className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${e(a.conceito).fundo} ${e(a.conceito).texto}`}>{a.conceito ?? "Sem conceito aprovado"}</span>
          <span aria-hidden className="font-bold text-suave">→</span>
          <span className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${e(d.conceito).fundo} ${e(d.conceito).texto}`}>{d.conceito ?? "Sem conceito aprovado"}</span>
        </div>
        <p className={`text-center text-[15px] font-bold ${c.mudanca === "evoluiu" ? "text-ok" : c.mudanca === "caiu" ? "text-ruim" : "text-suave"}`}>
          {c.mudanca === "evoluiu"
            ? `Evoluiu ${Math.abs(c.degraus) === 1 ? "um conceito" : `${Math.abs(c.degraus)} conceitos`}`
            : c.mudanca === "caiu"
              ? `Caiu ${Math.abs(c.degraus) === 1 ? "um conceito" : `${Math.abs(c.degraus)} conceitos`}`
              : c.mudanca === "manteve"
                ? "Manteve o conceito"
                : "Falta aprovar para comparar os conceitos"}
        </p>
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-suave">
              <th scope="col" className="py-1 text-left font-semibold"><span className="sr-only">Item</span></th>
              <th scope="col" className="py-1 text-right font-semibold">Antes</th>
              <th scope="col" className="py-1 pl-3 text-right font-semibold">Depois</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-borda">
              <th scope="row" className="py-2 text-left font-medium">Itens entregues</th>
              <td className="text-right">{c.totalAntes ? `${c.entreguesAntes} de ${c.totalAntes}` : "—"}</td>
              <td className="pl-3 text-right font-bold">{c.totalDepois ? `${c.entreguesDepois} de ${c.totalDepois}` : "—"}</td>
            </tr>
            <tr className="border-t border-borda">
              <th scope="row" className="py-2 text-left font-medium">Prazo</th>
              <td className="text-right">{a.atrasou ? "Com atraso" : "No prazo"}</td>
              <td className={`pl-3 text-right font-bold ${d.atrasou ? "text-alerta" : ""}`}>{d.atrasou ? (d.diasDeAtraso ? `${d.diasDeAtraso} ${d.diasDeAtraso === 1 ? "dia" : "dias"} de atraso` : "Com atraso") : "No prazo"}</td>
            </tr>
          </tbody>
        </table>
        {aviso ? <p className="rounded-xl bg-alerta-fundo px-3 py-2 text-xs text-alerta">Uma das entregas ainda não foi aprovada por você: o conceito dela é só um rascunho e por isso não entra na comparação.</p> : null}
      </section>

      <section aria-label={`O que faltou na entrega ${a.numero}`} className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-suave">O que faltou na entrega {a.numero}</h3>
        {c.faltouAntes.length ? (
          <ul className="flex flex-col gap-1.5">
            {c.faltouAntes.map((f) => (
              <li key={f.item} className="flex items-start gap-2.5 rounded-xl border border-borda bg-cartao px-3 py-2.5 text-sm">
                <IconeItem status={f.status as StatusItem} />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <b>{f.item}</b>
                  <br />
                  <span className="font-semibold text-suave">{rotuloStatus(f.status)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-borda bg-cartao px-3 py-2.5 text-sm text-suave">Nada faltou: todos os itens foram entregues.</p>
        )}
        {a.devolutiva ? (
          <p className="rounded-xl bg-marca-clara px-3 py-2.5 text-[13px] leading-relaxed text-marca-forte [overflow-wrap:anywhere]">
            <b>O que você pediu na devolutiva:</b> “{a.devolutiva.length > 300 ? `${a.devolutiva.slice(0, 300).trimEnd()}…` : a.devolutiva}”
          </p>
        ) : null}
      </section>

      <section aria-label={`Como ficou na entrega ${d.numero}`} className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-suave">Como ficou na entrega {d.numero}</h3>
        {c.depois.length ? (
          <ul className="flex flex-col gap-1.5">
            {c.depois.map((f) => (
              <li key={f.item} className="flex items-start gap-2.5 rounded-xl border border-borda bg-cartao px-3 py-2.5 text-sm">
                <IconeItem status={f.status as StatusItem} />
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <b>{f.item}</b>
                  <br />
                  <span className="font-semibold text-suave">{rotuloStatus(f.status)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-suave">Esta entrega não tem checklist.</p>
        )}
      </section>

      <p className="text-xs leading-relaxed text-suave">
        Cada entrega pede coisas diferentes, por isso os itens não são ligados um ao outro. Você vê o que faltou antes e como ficou depois, lado a lado.
      </p>
    </section>
  );
}

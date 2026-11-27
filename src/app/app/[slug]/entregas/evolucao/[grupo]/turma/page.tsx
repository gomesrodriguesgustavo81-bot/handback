import type { Metadata } from "next";
import Link from "next/link";
import { ESTILO_CONCEITO } from "@/components/conceito";
import { completarVocabulario } from "@/lib/nomes";
import { compararComTurma, MINIMO_DA_TURMA, paraEntregaDaTurma, pontosComparaveis } from "@/lib/linha-do-tempo";
import { carregarLinhaDoTempo, entregasDaEtapa } from "@/lib/linha-do-tempo-dados";

export const metadata: Metadata = { title: "Comparar com a turma" };

const NOME: Record<string, string> = { EXCELENTE: "Excelente", BOM: "Bom", REGULAR: "Regular", RUIM: "Ruim" };
const COR_BARRA: Record<string, string> = { EXCELENTE: "bg-exc", BOM: "bg-bom", REGULAR: "bg-reg", RUIM: "bg-ruim" };
const rotuloStatus = (s: string | null) => (s === "ENTREGUE" ? "entregue" : s === "PARCIAL" ? "em parte" : s === "NAO_ENTREGUE" ? "não entregue" : "sem dado");
const classeStatus = (s: string | null) => (s === "ENTREGUE" ? "bg-ok-fundo text-ok" : s === "PARCIAL" ? "bg-alerta-fundo text-alerta" : "bg-ruim-fundo text-ruim");

export default async function CompararComTurma({ params, searchParams }: PageProps<"/app/[slug]/entregas/evolucao/[grupo]/turma">) {
  const { slug, grupo: grupoId } = await params;
  const { entrega: q } = await searchParams;
  const { empresa, turma, grupo, pontos, base } = await carregarLinhaDoTempo(slug, grupoId);
  const v = completarVocabulario(empresa.vocabulario);
  const lista = pontosComparaveis(pontos);
  const escolhida = lista.find((p) => p.etapaId === q) ?? lista.at(-1);
  const ehEquipe = turma.modo === "grupos";
  const dela = escolhida ? await entregasDaEtapa(empresa.id, turma.id, escolhida.etapaId) : [];
  const c = escolhida ? compararComTurma(grupo.id, dela.map(paraEntregaDaTurma)) : null;
  const total = c ? Math.max(1, ...c.distribuicao.map((d) => d.quantidade)) : 1;
  const outros = ehEquipe ? v.grupos.toLowerCase() : v.pessoas.toLowerCase();

  return (
    <section className="flex flex-col gap-4 sm:max-w-2xl">
      <Link href={base} className="inline-flex min-h-11 items-center text-sm font-semibold text-marca-forte hover:underline">
        ← {grupo.nome}
      </Link>
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Comparar com a turma</h2>
        <p className="text-[13px] leading-relaxed text-suave">
          {turma.nome}. Só números da turma: não aparece nome nem conceito de colegas.
          {ehEquipe ? ` Como a turma trabalha em ${v.grupos.toLowerCase()}, a comparação é com as outras ${v.grupos.toLowerCase()}.` : ""}
        </p>
      </div>

      {!escolhida || !c ? (
        <p className="rounded-2xl border border-dashed border-borda p-4 text-sm text-suave">Ainda não há uma entrega analisada deste(a) {ehEquipe ? v.grupo.toLowerCase() : v.pessoa.toLowerCase()} para comparar.</p>
      ) : (
        <>
          <form method="get" className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-suave">
              Entrega
              <select name="entrega" defaultValue={escolhida.etapaId} className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-2.5 text-sm font-semibold">
                {lista.map((p) => (
                  <option key={p.etapaId} value={p.etapaId}>Entrega {p.numero} · {p.titulo}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="min-h-11 rounded-xl bg-marca px-4 text-sm font-bold text-sobre-marca">Ver esta entrega</button>
          </form>

          {!c.confiavel ? (
            <p role="note" className="rounded-2xl border border-alerta/30 bg-alerta-fundo px-4 py-3 text-sm text-alerta">
              <b>Comparação pouco confiável:</b> só {c.aprovados} {c.aprovados === 1 ? "entrega aprovada" : "entregas aprovadas"} nesta entrega (o mínimo é {MINIMO_DA_TURMA}). Os números abaixo mudam bastante a cada aprovação.
            </p>
          ) : null}

          <section aria-label="Conceito" className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
            <h3 className="text-[15px] font-bold">Conceito</h3>
            <p className="text-[13px] text-suave">
              {escolhida.conceito ? (
                <>
                  Ficou com <b className={ESTILO_CONCEITO[escolhida.conceito]?.texto}>{NOME[escolhida.conceito] ?? escolhida.conceito}</b>, junto com {Math.max(0, c.mesmoConceito - 1)} {Math.max(0, c.mesmoConceito - 1) === 1 ? "outro" : "outros"} de {Math.max(0, c.aprovados - 1)} que já {c.aprovados - 1 === 1 ? "tem" : "têm"} conceito aprovado.
                </>
              ) : (
                <>O conceito desta entrega ainda não foi aprovado por você, por isso não entra na conta.</>
              )}
            </p>
            <ul className="flex flex-col gap-2 text-[13px]">
              {c.distribuicao.map((d) => {
                const meu = d.conceito === escolhida.conceito;
                return (
                  <li key={d.conceito} className={`grid grid-cols-[4.5rem_minmax(0,1fr)_2rem] items-center gap-2 rounded-lg ${meu ? "bg-marca-clara px-1.5 py-1 font-bold text-marca-forte" : ""}`}>
                    <span>{NOME[d.conceito]}{meu ? " · este(a)" : ""}</span>
                    <span aria-hidden className="block h-3 overflow-hidden rounded-md bg-neutro-fundo">
                      <span className={`block h-full ${COR_BARRA[d.conceito]}`} style={{ width: `${(d.quantidade / total) * 100}%` }} />
                    </span>
                    <span className="text-right">{d.quantidade}</span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-suave">Quem ainda não tem conceito aprovado nesta entrega não entra na conta.</p>
          </section>

          <section aria-label="Itens e prazo" className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-borda bg-cartao p-3">
              <p className="text-xs text-suave">Itens entregues</p>
              <p className="mt-1 text-xl font-extrabold">{c.totalItens ? `${escolhida.entregues} de ${c.totalItens}` : "—"}</p>
              <p className="text-xs text-suave">{c.mediaEntregues !== null ? `Média da turma: ${String(c.mediaEntregues).replace(".", ",")} de ${c.totalItens}` : "Sem checklist"}</p>
            </div>
            <div className="rounded-2xl border border-borda bg-cartao p-3">
              <p className="text-xs text-suave">Prazo</p>
              <p className={`mt-1 text-xl font-extrabold ${escolhida.atrasou ? "text-alerta" : ""}`}>{escolhida.atrasou ? "Atrasou" : "No prazo"}</p>
              <p className="text-xs text-suave">{c.noPrazo} de {c.comPrazo} entregaram no prazo</p>
            </div>
          </section>

          {c.itens.length ? (
            <section aria-label="Item por item" className="flex flex-col gap-2.5 rounded-2xl border border-borda bg-cartao p-4">
              <h3 className="text-[15px] font-bold">Item por item</h3>
              <p className="text-[13px] text-suave">Quantos {outros} entregaram o item completo, e como ficou este(a).</p>
              <ul className="flex flex-col">
                {c.itens.map((i) => (
                  <li key={i.item} className="flex items-center justify-between gap-3 border-t border-borda py-2.5 text-sm first:border-t-0">
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      <b>{i.item}</b>
                      <br />
                      <span className="text-xs text-suave">Turma: {i.turmaCompleto}% completo</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${classeStatus(i.seuStatus)}`}>{rotuloStatus(i.seuStatus)}</span>
                  </li>
                ))}
              </ul>
              {c.maisDificil ? (
                <p className="rounded-xl bg-marca-clara px-3 py-2.5 text-[13px] leading-relaxed text-marca-forte">
                  O item em que menos gente entregou tudo (“{c.maisDificil}”) pode valer uma explicação para a turma toda.
                </p>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}

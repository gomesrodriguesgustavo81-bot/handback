import type { Metadata } from "next";
import Link from "next/link";
import { ESTILO_CONCEITO, Pilula } from "@/components/conceito";
import { SeloAlertas } from "@/components/alertas";
import { mudancaDeConceito, podeCompararEntregas, pontosComparaveis, type Ponto } from "@/lib/linha-do-tempo";
import { carregarLinhaDoTempo } from "@/lib/linha-do-tempo-dados";
import { dataBR } from "@/lib/textos";

export const metadata: Metadata = { title: "Linha do tempo" };

const SITUACAO: Record<Ponto["situacao"], { rotulo: string; classe: string }> = {
  aprovada: { rotulo: "Aprovada", classe: "bg-ok-fundo text-ok" },
  revisar: { rotulo: "Falta você revisar", classe: "bg-alerta-fundo text-alerta" },
  "sem-analise": { rotulo: "Sem análise", classe: "bg-neutro-fundo text-neutro" },
  "nao-entregou": { rotulo: "Não entregou", classe: "bg-ruim-fundo text-ruim" },
  aguardando: { rotulo: "Aguardando", classe: "bg-neutro-fundo text-neutro" },
};

export default async function LinhaDoTempo({ params }: PageProps<"/app/[slug]/entregas/evolucao/[grupo]">) {
  const { slug, grupo: grupoId } = await params;
  const { grupo, pontos, base } = await carregarLinhaDoTempo(slug, grupoId);
  const analisadas = pontosComparaveis(pontos);
  const aprovadas = pontos.filter((p) => p.situacao === "aprovada");
  const ultimo = aprovadas.at(-1);
  const antes = aprovadas.at(-2);
  const mudou = mudancaDeConceito(antes?.conceito ?? null, ultimo?.conceito ?? null);
  const alertas = pontos.reduce((s, p) => s + p.alertas, 0);
  const pode = podeCompararEntregas(pontos);
  const caixa = "flex min-h-12 items-center justify-between gap-2 rounded-2xl border border-borda bg-cartao px-4 text-sm font-bold text-marca";

  return (
    <section className="flex flex-col gap-4 sm:max-w-2xl">
      <Link href={`/app/${slug}/entregas/evolucao`} className="inline-flex min-h-11 items-center text-sm font-semibold text-marca-forte hover:underline">
        ← Evolução
      </Link>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-2xl font-extrabold tracking-tight">{grupo.nome}</h2>
          {grupo.tema ? <p className="break-words text-sm text-suave">Tema: {grupo.tema}</p> : null}
        </div>
        {mudou.mudanca !== "sem-comparacao" ? (
          <Pilula className={mudou.mudanca === "evoluiu" ? "bg-ok-fundo text-ok" : mudou.mudanca === "caiu" ? "bg-ruim-fundo text-ruim" : "bg-neutro-fundo text-neutro"}>
            <span aria-hidden className="mr-1">{mudou.mudanca === "evoluiu" ? "↑" : mudou.mudanca === "caiu" ? "↓" : "→"}</span>
            {mudou.mudanca === "evoluiu" ? "Melhorou" : mudou.mudanca === "caiu" ? "Caiu" : "Manteve"}
          </Pilula>
        ) : null}
      </header>

      <dl className="grid grid-cols-3 gap-2">
        <Numero rotulo="Entregas" valor={`${pontos.filter((p) => p.entregaId).length} de ${pontos.length}`} />
        <Numero rotulo="Último" valor={ultimo?.conceito ?? "—"} />
        <Numero rotulo="Alertas" valor={String(alertas)} />
      </dl>

      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-suave">Linha do tempo</h3>
      {!pontos.length ? (
        <p className="rounded-2xl border border-dashed border-borda p-4 text-sm text-suave">Ainda não há entregas cadastradas nesta turma.</p>
      ) : (
        <ol aria-label="Entregas em ordem" className="flex flex-col">
          {pontos.map((p, i) => {
            const e = ESTILO_CONCEITO[p.conceito ?? ""] ?? ESTILO_CONCEITO.PENDENTE;
            const anterior = pontos.slice(0, i).reverse().find((x) => x.situacao === "aprovada");
            const m = p.situacao === "aprovada" ? mudancaDeConceito(anterior?.conceito ?? null, p.conceito) : null;
            const aberta = p.situacao === "aguardando";
            return (
              <li key={p.etapaId} className="flex gap-3">
                <span aria-hidden className="flex w-4 flex-col items-center">
                  <span className={`mt-5 size-3.5 rounded-full ${aberta ? "border-2 border-borda bg-cartao" : p.situacao === "aprovada" ? "bg-marca" : "bg-alerta"}`} />
                  {i < pontos.length - 1 ? <span className="mt-1 w-0.5 flex-1 bg-borda" /> : null}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2 pb-3">
                  <article className={`flex flex-col gap-2.5 rounded-2xl p-4 ${aberta ? "border-2 border-dashed border-borda" : "border border-borda bg-cartao"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-suave">Entrega {p.numero}</p>
                        <h4 className="break-words text-base font-bold">{p.titulo}</h4>
                      </div>
                      {p.conceito ? (
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${e.fundo} ${e.texto}`}>{p.conceito}</span>
                      ) : (
                        <Pilula className={SITUACAO[p.situacao].classe}>{SITUACAO[p.situacao].rotulo}</Pilula>
                      )}
                    </div>
                    {p.entregaId ? (
                      <p className="text-[13px] text-suave">
                        {p.atrasou ? <b className="text-alerta">{p.diasDeAtraso ? `${p.diasDeAtraso} ${p.diasDeAtraso === 1 ? "dia" : "dias"} de atraso` : "Entregue com atraso"}</b> : "Entregue no prazo"}
                      </p>
                    ) : (
                      <p className="text-[13px] text-suave">{aberta ? `Ainda no prazo${p.prazo ? ` · até ${dataBR(p.prazo)}` : ""}` : `Prazo encerrado${p.prazo ? ` em ${dataBR(p.prazo)}` : ""}`}</p>
                    )}
                    {p.itens.length ? (
                      <div>
                        <p className="mb-1 text-[13px] font-semibold">
                          {p.entregues} de {p.itens.length} itens do checklist
                        </p>
                        <ul aria-hidden className="grid gap-1" style={{ gridTemplateColumns: `repeat(${p.itens.length}, minmax(0, 1fr))` }}>
                          {p.itens.map((it, k) => (
                            <li key={k} className={`h-1.5 rounded-full ${it.status === "ENTREGUE" ? "bg-ok" : it.status === "PARCIAL" ? "bg-reg" : "bg-borda"}`} />
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {p.alertas ? <SeloAlertas quantidade={p.alertas} critico={p.grave} /> : null}
                    {p.devolutiva ? <p className="rounded-xl bg-fundo px-3 py-2.5 text-[13px] leading-relaxed [overflow-wrap:anywhere]">“{p.devolutiva.length > 220 ? `${p.devolutiva.slice(0, 220).trimEnd()}…` : p.devolutiva}”</p> : null}
                    {p.entregaId ? (
                      <Link href={`/app/${slug}/entregas/${p.entregaId}`} className="inline-flex min-h-11 items-center text-[13px] font-bold text-marca hover:underline">
                        {p.devolutiva ? "Ver devolutiva completa ›" : "Abrir a entrega ›"}
                      </Link>
                    ) : null}
                  </article>
                  {m && m.mudanca !== "sem-comparacao" ? (
                    <p className={`ml-1 self-start rounded-full px-3 py-1 text-xs font-bold ${m.mudanca === "evoluiu" ? "bg-ok-fundo text-ok" : m.mudanca === "caiu" ? "bg-ruim-fundo text-ruim" : "bg-neutro-fundo text-neutro"}`}>
                      {m.mudanca === "evoluiu" ? "↑ Evoluiu" : m.mudanca === "caiu" ? "↓ Caiu" : "→ Manteve"}: {anterior!.conceito} para {p.conceito}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <section aria-label="Comparar (opcional)" className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-suave">Comparar (opcional)</h3>
        {pode ? (
          <Link href={`${base}/comparar`} className={caixa}>
            Com outra entrega dele(a) <span aria-hidden>›</span>
          </Link>
        ) : (
          <p className="flex min-h-12 items-center rounded-2xl border border-dashed border-borda px-4 py-2 text-sm text-suave">
            Com outra entrega dele(a): precisa de pelo menos 2 entregas analisadas (agora há {analisadas.length}).
          </p>
        )}
        <Link href={`${base}/turma`} className={caixa}>
          Com a turma <span aria-hidden>›</span>
        </Link>
      </section>
    </section>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col-reverse gap-0.5 rounded-2xl border border-borda bg-cartao px-3 py-2.5">
      <dt className="text-xs text-suave">{rotulo}</dt>
      <dd className="text-lg font-extrabold">{valor}</dd>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cabecalho, dataCurta, Folha, GraficoEvolucao, Numeros, Rodape, TextoCelula } from "@/components/relatorio";
import { contextoDaEmpresa } from "@/lib/empresa";
import { quemEntrega } from "@/lib/nomes";
import { carregarRelatorio, nota, type Celula } from "@/lib/relatorios";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";
import { BarraRelatorio } from "../barra";

export const metadata: Metadata = { title: "Relatório de evolução" };

export default async function RelatorioEquipe({ params, searchParams }: PageProps<"/app/[slug]/relatorios/equipe">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) notFound();
  const turma = await turmaAtual(empresa.id);
  if (!turma) notFound();
  const supabase = await criarClienteServidor();
  const r = await carregarRelatorio(supabase, empresa, turma.id, sp.aulas === "encerradas" ? "encerradas" : "todas");
  if (!r) notFound();
  const comDev = sp.dev !== "0";
  const comCheck = sp.check !== "0";
  const comMat = sp.mat === "1";
  const grupos = sp.g === "todas" ? r.grupos : r.grupos.filter((g) => g.id === sp.g);
  if (!grupos.length) notFound();
  const um = quemEntrega(r.vc, r.turma.modo).um;
  const { data: eu } = await supabase.auth.getUser();

  return (
    <div className="flex flex-col gap-4">
      <BarraRelatorio voltar={`/app/${slug}/relatorios`} />
      {grupos.map((g) => {
        const aprovados = g.celulas.filter((c): c is Extract<Celula, { tipo: "aprovado" }> => c.tipo === "aprovado");
        const entregues = g.celulas.filter((c) => c.tipo === "aprovado" || c.tipo === "pendente") as Extract<Celula, { atrasada: boolean }>[];
        const ultimo = g.celulas.map((c, i) => ({ c, i })).filter((x) => x.c.tipo === "aprovado").at(-1);
        const feitos = aprovados.reduce((s, c) => s + c.feitos, 0);
        const total = aprovados.reduce((s, c) => s + c.total, 0);
        const numeros = [
          {
            rotulo: "Conceito mais recente",
            valor: ultimo && ultimo.c.tipo === "aprovado" ? ultimo.c.conceito : "—",
            detalhe: ultimo ? `${r.vc.etapa} ${r.etapas[ultimo.i].numero}` : "ainda sem conceito",
          },
          {
            rotulo: "Entregas",
            valor: `${entregues.length} de ${r.etapas.length}`,
            detalhe: entregues.some((c) => c.atrasada) ? `${entregues.filter((c) => c.atrasada).length} com atraso` : "nenhuma atrasada",
          },
          ...(comCheck ? [{ rotulo: "Checklist", valor: total ? `${feitos} de ${total}` : "—", detalhe: "itens entregues" }] : []),
          ...(r.turma.mediaAtiva ? [{ rotulo: "Média final", valor: nota(g.media), detalhe: "de 0 a 10, com os pesos" }] : []),
        ];
        const devolutivas = g.celulas
          .map((c, i) => ({ c, e: r.etapas[i] }))
          .filter((x): x is { c: Extract<Celula, { tipo: "aprovado" }>; e: (typeof r.etapas)[number] } => x.c.tipo === "aprovado" && Boolean(x.c.devolutiva))
          .reverse();
        return (
          <Folha key={g.id}>
            <Cabecalho
              antes={`${r.org.nome} · ${r.turma.nome} · Relatório de evolução`}
              titulo={g.nome}
              depois={
                r.turma.modo === "individual"
                  ? [g.pessoas[0]?.email, comMat && g.pessoas[0]?.matricula ? `${r.vc.matricula} ${g.pessoas[0].matricula}` : ""].filter(Boolean).join(" · ")
                  : g.pessoas.map((p) => (comMat && p.matricula ? `${p.nome} (${p.matricula})` : p.nome)).join(" · ")
              }
            />
            <Numeros itens={numeros} />
            <section className="sem-quebra flex flex-col gap-1.5">
              <h2 className="text-sm font-bold">
                Conceito {r.vc.etapa.toLowerCase()} a {r.vc.etapa.toLowerCase()}
              </h2>
              <GraficoEvolucao celulas={g.celulas} etapas={r.etapas} palavra={r.vc.etapa} />
            </section>
            <section className="flex flex-col gap-1.5">
              <h2 className="text-sm font-bold">
                {r.vc.etapa} a {r.vc.etapa.toLowerCase()}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="text-left text-[#4b605d]">
                      <th className="border-b border-[#d9e3e0] px-2 py-1.5 font-semibold">{r.vc.etapa}</th>
                      <th className="border-b border-[#d9e3e0] px-2 py-1.5 font-semibold">Entregue em</th>
                      {comCheck ? <th className="border-b border-[#d9e3e0] px-2 py-1.5 font-semibold">Checklist</th> : null}
                      <th className="border-b border-[#d9e3e0] px-2 py-1.5 font-semibold">Conceito</th>
                      {r.turma.mediaAtiva ? <th className="border-b border-[#d9e3e0] px-2 py-1.5 text-right font-semibold">Nota · peso</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {r.etapas.map((e, i) => {
                      const c = g.celulas[i];
                      return (
                        <tr key={e.id}>
                          <td className="border-b border-[#eef2f0] px-2 py-1.5">
                            {e.numero} · {e.titulo}
                          </td>
                          <td className="border-b border-[#eef2f0] px-2 py-1.5">
                            {c.tipo === "aprovado" || c.tipo === "pendente" ? `${dataCurta(c.entregueEm)}${c.atrasada ? " · atrasada" : ""}` : "—"}
                          </td>
                          {comCheck ? (
                            <td className="border-b border-[#eef2f0] px-2 py-1.5">{c.tipo === "aprovado" && c.total ? `${c.feitos} de ${c.total}` : "—"}</td>
                          ) : null}
                          <td className="border-b border-[#eef2f0] px-2 py-1.5">
                            <TextoCelula c={c} />
                          </td>
                          {r.turma.mediaAtiva ? (
                            <td className="border-b border-[#eef2f0] px-2 py-1.5 text-right tabular-nums">
                              {c.tipo === "aprovado" ? nota(c.nota) : c.tipo === "nao-entregou" ? "0,0" : "—"} · {String(e.peso).replace(".", ",")}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
            {comDev && devolutivas.length ? (
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-bold">Devolutivas</h2>
                {devolutivas.map(({ c, e }) => (
                  <div key={e.id} className="sem-quebra flex flex-col gap-1 rounded-xl border border-[#d9e3e0] px-3 py-2.5">
                    <span className="text-xs text-[#4b605d]">
                      <strong className="text-[#0e2b28]">
                        {r.vc.etapa} {e.numero} · {c.conceito}
                      </strong>
                      {c.devolvidaEm ? ` · ${dataCurta(c.devolvidaEm)}` : ""}
                    </span>
                    <p className="whitespace-pre-line">{c.devolutiva}</p>
                  </div>
                ))}
              </section>
            ) : null}
            {r.turma.mediaAtiva ? (
              <p className="text-[11px] text-[#4b605d]">
                Média ponderada pelos pesos de cada {r.vc.etapa.toLowerCase()}. {r.vc.etapa} encerrad{r.vc.generos.etapa === "f" ? "a" : "o"} sem entrega conta 0; o que
                ainda não foi avaliado fica de fora.
              </p>
            ) : null}
            <Rodape r={r} autor={eu.user?.email ?? undefined} />
          </Folha>
        );
      })}
      {grupos.length > 1 ? <p className="text-center text-xs text-suave print:hidden">{grupos.length} folhas, uma para cada {um.toLowerCase()}. Ao imprimir, cada uma começa numa página nova.</p> : null}
    </div>
  );
}

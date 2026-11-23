import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BarrasTurma, Cabecalho, Folha, Numeros, Rodape, TextoCelula } from "@/components/relatorio";
import { contextoDaEmpresa } from "@/lib/empresa";
import { quemEntrega } from "@/lib/nomes";
import { carregarRelatorio, nota } from "@/lib/relatorios";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";
import { BarraRelatorio } from "../barra";

export const metadata: Metadata = { title: "Relatório da turma" };

export default async function RelatorioTurma({ params, searchParams }: PageProps<"/app/[slug]/relatorios/turma">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) notFound();
  const turma = await turmaAtual(empresa.id);
  if (!turma) notFound();
  const supabase = await criarClienteServidor();
  const r = await carregarRelatorio(supabase, empresa, turma.id, sp.aulas === "encerradas" ? "encerradas" : "todas");
  if (!r) notFound();
  const comMat = sp.mat === "1";
  const nomes = quemEntrega(r.vc, r.turma.modo);
  const { data: eu } = await supabase.auth.getUser();

  const celulas = r.grupos.flatMap((g) => g.celulas);
  const encerradas = r.etapas.filter((e, i) => r.grupos.some((g) => g.celulas[i].tipo !== "aguardando"));
  const entregues = celulas.filter((c) => c.tipo === "aprovado" || c.tipo === "pendente");
  const atrasadas = entregues.filter((c) => (c.tipo === "aprovado" || c.tipo === "pendente") && c.atrasada).length;
  const faltas = celulas.filter((c) => c.tipo === "nao-entregou").length;
  const iUlt = [...r.etapas.keys()].reverse().find((i) => r.grupos.some((g) => g.celulas[i].tipo === "aprovado"));
  const bons = (i: number) => r.grupos.filter((g) => { const c = g.celulas[i]; return c.tipo === "aprovado" && (c.conceito === "BOM" || c.conceito === "EXCELENTE"); }).length;
  const aprovadas = celulas.filter((c) => c.tipo === "aprovado").length;
  const atencao = r.grupos.filter((g) => g.atencao.length);
  const pessoas = r.grupos.reduce((s, g) => s + g.pessoas.length, 0);
  const medias = r.grupos.map((g) => g.media).filter((m): m is number => m !== null);

  const numeros = [
    { rotulo: "Entregas feitas", valor: `${entregues.length} de ${entregues.length + faltas}`, detalhe: `${atrasadas} com atraso · ${faltas} faltaram` },
    {
      rotulo: "Bom ou Excelente",
      valor: iUlt === undefined ? "—" : `${bons(iUlt)} de ${r.grupos.length}`,
      detalhe: iUlt === undefined ? "ainda sem conceitos" : `n${/a$/i.test(r.vc.etapa) ? "a" : "o"} ${r.vc.etapa} ${r.etapas[iUlt].numero}`,
    },
    { rotulo: "Conceitos aprovados", valor: String(aprovadas), detalhe: "todos revisados por um professor" },
    ...(r.turma.mediaAtiva && medias.length
      ? [{ rotulo: "Média da turma", valor: nota(Math.round((medias.reduce((a, b) => a + b, 0) / medias.length) * 10) / 10), detalhe: "de 0 a 10" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <BarraRelatorio voltar={`/app/${slug}/relatorios`} />
      <Folha>
        <Cabecalho
          antes={`${r.org.nome} · Relatório da turma${
            !encerradas.length ? "" : r.etapas.length === 1 ? ` · ${r.vc.etapa} ${r.etapas[0].numero}` : ` · ${r.vc.etapas} ${r.etapas[0].numero} a ${r.etapas.at(-1)!.numero}`
          }`}
          titulo={r.turma.nome}
          depois={`${r.grupos.length} ${(r.grupos.length === 1 ? nomes.um : nomes.varios).toLowerCase()}${r.turma.modo === "grupos" ? ` · ${pessoas} ${pessoas === 1 ? "aluno" : "alunos"}` : ""}`}
        />
        <Numeros itens={numeros} />
        {r.etapas.length ? (
          <section className="sem-quebra flex flex-col gap-1.5">
            <h2 className="text-sm font-bold">Conceitos em cada {r.vc.etapa.toLowerCase()}</h2>
            <BarrasTurma r={r} />
          </section>
        ) : null}
        <section className="sem-quebra flex flex-col gap-1.5">
          <h2 className="text-sm font-bold">Precisam de atenção</h2>
          {atencao.length ? (
            atencao.map((g) => (
              <div key={g.id} className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 rounded-xl bg-[#fdf0d9] px-3 py-2">
                <strong>{g.nome}</strong>
                <span className="text-[#5c3a00]">{g.atencao.join(" · ")}</span>
              </div>
            ))
          ) : (
            <p className="text-[#4b605d]">Ninguém: todos entregaram e nenhum conceito caiu.</p>
          )}
        </section>
        <section className="flex flex-col gap-1.5">
          <h2 className="text-sm font-bold">
            {nomes.um} por {nomes.um.toLowerCase()}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-left text-[#4b605d]">
                  <th className="border-b border-[#d9e3e0] px-2 py-1.5 font-semibold">{nomes.um}</th>
                  {r.etapas.map((e) => (
                    <th key={e.id} className="border-b border-[#d9e3e0] px-2 py-1.5 font-semibold">
                      {r.vc.etapa} {e.numero}
                    </th>
                  ))}
                  {r.turma.mediaAtiva ? <th className="border-b border-[#d9e3e0] px-2 py-1.5 text-right font-semibold">Média</th> : null}
                </tr>
              </thead>
              <tbody>
                {r.grupos.map((g) => (
                  <tr key={g.id} className="sem-quebra">
                    <td className="border-b border-[#eef2f0] px-2 py-1.5 font-semibold">
                      {g.nome}
                      {comMat && r.turma.modo === "individual" && g.pessoas[0]?.matricula ? <span className="font-normal text-[#4b605d]"> ({g.pessoas[0].matricula})</span> : null}
                    </td>
                    {g.celulas.map((c, i) => (
                      <td key={i} className="border-b border-[#eef2f0] px-2 py-1.5">
                        <TextoCelula c={c} />
                      </td>
                    ))}
                    {r.turma.mediaAtiva ? <td className="border-b border-[#eef2f0] px-2 py-1.5 text-right tabular-nums">{nota(g.media)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <Rodape r={r} autor={eu.user?.email ?? undefined} />
      </Folha>
    </div>
  );
}

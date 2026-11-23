import { NextResponse, type NextRequest } from "next/server";
import { contextoDaEmpresa } from "@/lib/empresa";
import { csvDaTurma, csvMoodle, xlsxDaTurma } from "@/lib/planilha";
import { carregarRelatorio } from "@/lib/relatorios";
import { criarClienteServidor } from "@/lib/supabase/server";
import { gerarSlug } from "@/lib/caminhos";
import { turmaAtual } from "@/lib/turma";

/** Baixa a planilha da turma aberta (Excel, CSV ou o arquivo de notas do Moodle). */
export async function GET(request: NextRequest, { params }: RouteContext<"/app/[slug]/relatorios/planilha">) {
  const { slug } = await params;
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return NextResponse.json({ erro: "sem permissão" }, { status: 404 });
  const turma = await turmaAtual(empresa.id);
  if (!turma) return NextResponse.json({ erro: "sem turma" }, { status: 404 });
  const p = request.nextUrl.searchParams;
  const supabase = await criarClienteServidor();
  const r = await carregarRelatorio(supabase, empresa, turma.id, p.get("aulas") === "encerradas" ? "encerradas" : "todas");
  if (!r) return NextResponse.json({ erro: "sem turma" }, { status: 404 });
  const nome = `handback-${gerarSlug(r.turma.nome) || "turma"}`;
  const mat = p.get("mat") === "1";
  const cabecalhos = (tipo: string, arquivo: string) => ({
    "content-type": tipo,
    "content-disposition": `attachment; filename="${arquivo}"`,
    "cache-control": "no-store",
  });
  const formato = p.get("formato");
  if (formato === "csv") return new NextResponse(csvDaTurma(r, mat), { headers: cabecalhos("text/csv; charset=utf-8", `${nome}.csv`) });
  if (formato === "moodle") return new NextResponse(csvMoodle(r), { headers: cabecalhos("text/csv; charset=utf-8", `${nome}-notas-moodle.csv`) });
  const xlsx = await xlsxDaTurma(r, mat);
  return new NextResponse(new Uint8Array(xlsx), {
    headers: cabecalhos("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${nome}.xlsx`),
  });
}

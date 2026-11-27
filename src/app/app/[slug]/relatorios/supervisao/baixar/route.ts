import { NextResponse } from "next/server";
import { gerarSlug } from "@/lib/caminhos";
import { completarVocabulario, quemEntrega } from "@/lib/nomes";
import { registrarDocumento } from "@/lib/registro";
import { csvDaSupervisao } from "@/lib/supervisao";
import { dataHoraBR } from "@/lib/textos";
import { carregarSupervisao } from "../dados";

/** Baixa o registro de supervisão da turma aberta em planilha. O download fica no registro de atividades. */
export async function GET(_req: Request, { params }: RouteContext<"/app/[slug]/relatorios/supervisao/baixar">) {
  const { slug } = await params;
  const { empresa, turma, supabase, linhas } = await carregarSupervisao(slug);
  const vc = completarVocabulario(empresa.vocabulario);
  const csv = csvDaSupervisao(linhas, turma.nome, vc.etapa, quemEntrega(vc, turma.modo).um, (iso) => (iso ? dataHoraBR(iso) : ""));
  await registrarDocumento(supabase, empresa.id, "baixou_supervisao", `Baixou o registro de supervisão: ${turma.nome}`, null);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="supervisao-${gerarSlug(turma.nome) || "turma"}.csv"`,
      "cache-control": "no-store",
    },
  });
}

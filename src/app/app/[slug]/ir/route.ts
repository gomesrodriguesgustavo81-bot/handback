import { NextResponse, type NextRequest } from "next/server";
import { urlDoSite } from "@/lib/caminhos";
import { contextoDaEmpresa } from "@/lib/empresa";
import { cookieDaTurma, turmasDaEmpresa } from "@/lib/turma";

/**
 * Atalho do Início: escolhe a turma e vai direto para onde resolver
 * (ex.: /ir?turma=<id>&para=/app/<slug>/entregas).
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/app/[slug]/ir">) {
  const { slug } = await params;
  const p = request.nextUrl.searchParams;
  const base = `/app/${slug}/`;
  const para = p.get("para") ?? "";
  const destino = para.startsWith(base) && !para.includes("//") && !para.includes("\\") ? para : `${base}inicio`;
  const { empresa } = await contextoDaEmpresa(slug);
  const turma = (await turmasDaEmpresa(empresa.id)).find((t) => t.id === p.get("turma"));
  const r = NextResponse.redirect(urlDoSite(request, destino));
  if (turma) r.cookies.set(cookieDaTurma(empresa.id), turma.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  return r;
}

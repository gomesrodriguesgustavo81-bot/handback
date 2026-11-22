import { NextResponse, type NextRequest } from "next/server";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { celula, FILTROS_REGISTRO, lerFiltro, ROTULO_TIPO } from "../tipos";

/** Planilha (CSV que abre no Excel) com o registro de atividades da empresa. */
export async function GET(request: NextRequest, { params }: RouteContext<"/app/[slug]/registro/planilha">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return new NextResponse("Não encontrado", { status: 404 });
  const filtro = lerFiltro(request.nextUrl.searchParams.get("ver"));
  const quem = (request.nextUrl.searchParams.get("pessoa") ?? "").trim().toLowerCase().slice(0, 320);
  const supabase = await criarClienteServidor();
  let consulta = supabase
    .from("atividades")
    .select("email, tipo, descricao, ip, aparelho, criado_em")
    .eq("org_id", empresa.id)
    .order("id", { ascending: false })
    .limit(10000);
  const tipos = FILTROS_REGISTRO[filtro].tipos;
  if (tipos.length) consulta = consulta.in("tipo", tipos);
  if (quem) consulta = consulta.ilike("email", `%${quem.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  const { data } = await consulta;
  const linhas = [
    ["Data e hora", "Pessoa", "Tipo", "O que aconteceu", "IP", "Aparelho"].map(celula).join(";"),
    ...(data ?? []).map((l) =>
      [dataHoraBR(l.criado_em), l.email || "Sistema", ROTULO_TIPO[l.tipo] ?? l.tipo, l.descricao, l.ip, l.aparelho].map(celula).join(";"),
    ),
  ];
  const nome = `registro-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse("﻿" + linhas.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nome}"`,
      "cache-control": "no-store",
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { contextoDaEmpresa } from "@/lib/empresa";
import { registrarDocumento } from "@/lib/registro";
import { criarClienteServidor } from "@/lib/supabase/server";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Abre um arquivo de entrega: confere a permissão, registra quem baixou e
 * manda para um link temporário da área privada (vale 1 minuto).
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/app/[slug]/entregas/[id]/arquivo/[arquivo]">) {
  const { slug, id, arquivo } = await params;
  if (!UUID.test(id) || !UUID.test(arquivo)) return new NextResponse("Não encontrado", { status: 404 });
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return new NextResponse("Não encontrado", { status: 404 });
  const supabase = await criarClienteServidor();
  const { data: a } = await supabase
    .from("arquivos_entrega")
    .select("id, caminho, nome, entregas!inner(id, org_id, grupos(nome))")
    .eq("id", arquivo)
    .eq("entrega_id", id)
    .eq("entregas.org_id", empresa.id)
    .maybeSingle();
  if (!a) return new NextResponse("Não encontrado", { status: 404 });
  const { data: link } = await supabase.storage.from("entregas").createSignedUrl(a.caminho, 60);
  if (!link?.signedUrl) return new NextResponse("Arquivo indisponível", { status: 404 });
  const grupo = (a.entregas as unknown as { grupos: { nome: string } | null }).grupos?.nome ?? "?";
  await registrarDocumento(supabase, empresa.id, "baixou_arquivo", `Abriu o arquivo “${a.nome}” de ${grupo}`, id);
  return NextResponse.redirect(link.signedUrl, { headers: { "cache-control": "no-store" } });
}

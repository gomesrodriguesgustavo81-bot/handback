import { NextResponse, type NextRequest } from "next/server";
import { contextoDaEmpresa } from "@/lib/empresa";
import { registrarDocumento } from "@/lib/registro";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { baixarDoDrive } from "@/lib/drive";

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
    .select("id, caminho, nome, tipo, drive_id, drive_por, entregas!inner(id, org_id, grupos(nome))")
    .eq("id", arquivo)
    .eq("entrega_id", id)
    .eq("entregas.org_id", empresa.id)
    .maybeSingle();
  if (!a) return new NextResponse("Não encontrado", { status: 404 });
  const grupo = (a.entregas as unknown as { grupos: { nome: string } | null }).grupos?.nome ?? "?";
  // No Google Drive de quem ligou o Drive na turma: o Handback busca e entrega (a permissão já foi conferida acima).
  if (a.drive_id && a.drive_por) {
    const admin = criarClienteAdmin();
    if (!admin) return new NextResponse("Arquivo indisponível", { status: 503 });
    try {
      const dados = await baixarDoDrive(admin, a.drive_por, a.drive_id);
      await registrarDocumento(supabase, empresa.id, "baixou_arquivo", `Abriu o arquivo “${a.nome}” de ${grupo} (Google Drive)`, id);
      // Só PDF e imagem abrem na tela; o resto baixa. E nada do arquivo roda no site (sandbox).
      const seguro = /^(application\/pdf|image\/(png|jpe?g|gif|webp))$/i.test(a.tipo ?? "");
      return new NextResponse(new Uint8Array(dados), {
        headers: {
          "content-type": seguro ? a.tipo : "application/octet-stream",
          "content-disposition": `${seguro ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.nome)}`,
          "content-security-policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    } catch (e) {
      return new NextResponse(e instanceof Error ? e.message : "Arquivo indisponível", { status: 404 });
    }
  }
  if (!a.caminho) return new NextResponse("Arquivo indisponível", { status: 404 });
  const { data: link } = await supabase.storage.from("entregas").createSignedUrl(a.caminho, 60);
  if (!link?.signedUrl) return new NextResponse("Arquivo indisponível", { status: 404 });
  await registrarDocumento(supabase, empresa.id, "baixou_arquivo", `Abriu o arquivo “${a.nome}” de ${grupo}`, id);
  return NextResponse.redirect(link.signedUrl, { headers: { "cache-control": "no-store" } });
}

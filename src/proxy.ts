import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { lerConfigSupabase } from "@/lib/supabase/config";
import { urlDoSite } from "@/lib/caminhos";

/** Áreas que exigem login. */
const AREAS_PROTEGIDAS = ["/app", "/admin"];

/**
 * Roda antes de cada página: renova a sessão do Supabase e manda para
 * "/entrar" quem tenta abrir uma área protegida sem estar logado.
 */
export async function proxy(request: NextRequest) {
  const config = lerConfigSupabase();
  if (!config) return NextResponse.next({ request });

  let resposta = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.chave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(lista) {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
      },
    },
  });

  // Importante: getUser() confere a sessão no Supabase (não confia só no cookie).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = request.nextUrl.pathname;
  const protegida = AREAS_PROTEGIDAS.some((a) => caminho === a || caminho.startsWith(a + "/"));
  if (!user && protegida) {
    const url = urlDoSite(request, "/entrar");
    url.searchParams.set("voltar", caminho);
    return NextResponse.redirect(url);
  }

  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};

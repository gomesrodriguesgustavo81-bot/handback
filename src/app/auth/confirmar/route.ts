import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { criarClienteServidor } from "@/lib/supabase/server";
import { registrarAcesso } from "@/lib/registro";
import { caminhoSeguro, urlDoSite } from "@/lib/caminhos";

/**
 * Para onde o link do e-mail leva. Confirma o acesso, aceita convites
 * pendentes e manda a pessoa para dentro do app.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const voltar = caminhoSeguro(url.searchParams.get("voltar"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await criarClienteServidor();
  let ok = false;

  // Link no formato padrão do Supabase (sem os modelos do Handback): a sessão
  // vem depois do "#", que só o navegador enxerga. A tela /auth/continuar lê.
  if (!code && !tokenHash) {
    const destino = urlDoSite(request, "/auth/continuar");
    destino.searchParams.set("voltar", voltar);
    return NextResponse.redirect(destino);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo });
    ok = !error;
  }

  if (!ok) {
    return NextResponse.redirect(urlDoSite(request, "/entrar?erro=link"));
  }

  await supabase.rpc("aceitar_convites");
  await registrarAcesso(supabase, "entrou_link");
  return NextResponse.redirect(urlDoSite(request, voltar));
}

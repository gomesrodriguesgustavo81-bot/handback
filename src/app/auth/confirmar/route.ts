import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { criarClienteServidor } from "@/lib/supabase/server";
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
  return NextResponse.redirect(urlDoSite(request, voltar));
}

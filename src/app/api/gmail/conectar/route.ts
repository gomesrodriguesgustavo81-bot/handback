import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { caminhoSeguro, urlDoSite } from "@/lib/caminhos";
import { gmailConfigurado, urlDeAutorizacao } from "@/lib/gmail";
import { COOKIE_ESTADO, comAviso } from "@/lib/gmail-rotas";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Começa a conexão do Gmail: manda a pessoa para a tela de permissão do Google. */
export async function GET(request: NextRequest) {
  const voltar = caminhoSeguro(request.nextUrl.searchParams.get("voltar"));
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(urlDoSite(request, `/entrar?voltar=${encodeURIComponent(voltar)}`));
  if (!gmailConfigurado()) return NextResponse.redirect(urlDoSite(request, comAviso(voltar, "nao-configurado")));

  const estado = randomBytes(24).toString("base64url");
  const retorno = urlDoSite(request, "/api/gmail/retorno").toString();
  const resposta = NextResponse.redirect(urlDeAutorizacao(retorno, estado, user.email ?? undefined));
  resposta.cookies.set(COOKIE_ESTADO, `${estado}|${voltar}`, {
    httpOnly: true,
    secure: retorno.startsWith("https://"),
    sameSite: "lax",
    path: "/api/gmail",
    maxAge: 600,
  });
  return resposta;
}

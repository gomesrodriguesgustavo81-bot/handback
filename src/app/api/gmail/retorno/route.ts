import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { caminhoSeguro, urlDoSite } from "@/lib/caminhos";
import { cifrar, ErroGmail, trocarCodigo } from "@/lib/gmail";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { registrarAcesso } from "@/lib/registro";
import { COOKIE_ESTADO, comAviso } from "@/lib/gmail-rotas";

/** Volta da tela de permissão do Google: guarda a conexão (cifrada) e devolve a pessoa para onde estava. */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const [estadoGuardado = "", voltarGuardado] = (request.cookies.get(COOKIE_ESTADO)?.value ?? "").split("|");
  const voltar = caminhoSeguro(voltarGuardado);
  const ir = (aviso: string) => {
    const r = NextResponse.redirect(urlDoSite(request, comAviso(voltar, aviso)));
    r.cookies.delete({ name: COOKIE_ESTADO, path: "/api/gmail" });
    return r;
  };

  const estado = p.get("state") ?? "";
  if (!estadoGuardado || estado.length !== estadoGuardado.length || !timingSafeEqual(Buffer.from(estado), Buffer.from(estadoGuardado))) {
    return ir("expirou");
  }
  if (p.get("error")) return ir("cancelado");
  const codigo = p.get("code");
  if (!codigo) return ir("cancelado");

  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = criarClienteAdmin();
  if (!user || !admin) return ir("erro");

  try {
    const { email, renovacao } = await trocarCodigo(codigo, urlDoSite(request, "/api/gmail/retorno").toString());
    const { error } = await admin
      .from("contas_gmail")
      .upsert({ user_id: user.id, email, token_cifrado: cifrar(renovacao), conectada_em: new Date().toISOString(), invalida: false });
    if (error) return ir("erro");
    await registrarAcesso(supabase, "conectou_gmail");
    return ir("conectado");
  } catch (e) {
    return ir(e instanceof ErroGmail && /permissão/.test(e.message) ? "sem-permissao" : "erro");
  }
}

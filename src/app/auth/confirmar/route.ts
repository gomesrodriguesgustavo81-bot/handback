import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { criarClienteServidor } from "@/lib/supabase/server";
import { registrarAcesso } from "@/lib/registro";
import { caminhoSeguro, urlDoSite } from "@/lib/caminhos";
import { criarClienteAdmin } from "@/lib/supabase/admin";

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

  // Entrar com Google é só para quem já foi convidado: sem nenhuma empresa, o login é desfeito.
  // A conferência é feita pelo servidor, porque antes do código do celular o banco ainda esconde as empresas.
  if (url.searchParams.get("origem") === "google") {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const admin = criarClienteAdmin();
    if (user && admin) {
      const [{ count }, { data: dono }] = await Promise.all([
        admin.from("membros").select("org_id", { count: "exact", head: true }).eq("user_id", user.id),
        admin.from("administradores_plataforma").select("user_id").eq("user_id", user.id).maybeSingle(),
      ]);
      if (!count && !dono) {
        await supabase.auth.signOut();
        // Conta criada agora só pelo Google, sem convite: não fica sobrando.
        const soGoogle = (user.identities ?? []).every((i) => i.provider === "google");
        const novinha = Date.now() - new Date(user.created_at).getTime() < 10 * 60 * 1000;
        if (soGoogle && novinha && user.app_metadata?.senha_definida !== true) await admin.auth.admin.deleteUser(user.id);
        return NextResponse.redirect(urlDoSite(request, "/entrar?erro=google"));
      }
    }
  }

  await registrarAcesso(supabase, "entrou_link");
  return NextResponse.redirect(urlDoSite(request, voltar));
}

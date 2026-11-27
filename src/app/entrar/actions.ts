"use server";

import { redirect } from "next/navigation";
import { origemDoSite } from "@/lib/acesso";
import { caminhoSeguro } from "@/lib/caminhos";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { criarClienteServidor } from "@/lib/supabase/server";
import { registrarAcesso, registrarFalhaLogin } from "@/lib/registro";
import { contarSenhaErrada, mensagemDeTrava, minutosDeTrava, zerarTentativas } from "@/lib/tentativas";

export type EstadoEntrar = { ok: boolean; mensagem: string } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function muitasTentativas(e: { status?: number; message: string }) {
  return e.status === 429 || /rate|too many/i.test(e.message);
}

/** Entrar com e-mail e senha. Depois, o app pede o código das 2 etapas quando precisar. */
export async function entrarComSenha(_a: EstadoEntrar, dados: FormData): Promise<EstadoEntrar> {
  if (!supabaseConfigurado()) return { ok: false, mensagem: "O banco de dados ainda não foi ligado." };
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  const senha = String(dados.get("senha") ?? "");
  const voltar = caminhoSeguro(dados.get("voltar"));
  if (!EMAIL.test(email) || !senha) return { ok: false, mensagem: "Digite o e-mail e a senha." };

  // Já errou 5 vezes seguidas? Fica travado por 15 minutos, mesmo com a senha certa.
  const travado = await minutosDeTrava(email);
  if (travado > 0) return { ok: false, mensagem: mensagemDeTrava(travado) };

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) {
    if (!muitasTentativas(error)) {
      await registrarFalhaLogin(email);
      const trava = await contarSenhaErrada(email);
      if (trava > 0) return { ok: false, mensagem: mensagemDeTrava(trava) };
    }
    // Mesma mensagem para e-mail inexistente e senha errada (não revela quem tem conta).
    return {
      ok: false,
      mensagem: muitasTentativas(error)
        ? "Muitas tentativas seguidas. Espere alguns minutos e tente de novo."
        : "E-mail ou senha incorretos.",
    };
  }
  await zerarTentativas(email);
  await supabase.rpc("aceitar_convites");
  await registrarAcesso(supabase, "entrou_senha");
  redirect(voltar);
}

/** Entrar com a conta do Google (só funciona para quem já foi convidado). */
export async function entrarComGoogle(dados: FormData): Promise<void> {
  const voltar = caminhoSeguro(dados.get("voltar"));
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origemDoSite()}/auth/confirmar?origem=google&voltar=${encodeURIComponent(voltar)}` },
  });
  if (error || !data.url) redirect("/entrar?erro=google");
  redirect(data.url);
}

/** “Esqueci minha senha”: manda o link para criar uma nova. A resposta é sempre a mesma. */
export async function pedirNovaSenha(_a: EstadoEntrar, dados: FormData): Promise<EstadoEntrar> {
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { ok: false, mensagem: "Digite um e-mail válido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origemDoSite()}/auth/confirmar?voltar=/definir-senha`,
  });
  if (error && muitasTentativas(error)) {
    return { ok: false, mensagem: "Muitas tentativas seguidas. Espere alguns minutos e tente de novo." };
  }
  return {
    ok: true,
    mensagem: `Se ${email} tiver acesso ao Handback, vai receber em instantes um e-mail com o link para criar uma senha nova.`,
  };
}

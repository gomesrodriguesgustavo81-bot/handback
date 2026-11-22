"use server";

import { headers } from "next/headers";
import { criarClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { caminhoSeguro } from "@/lib/caminhos";

export type EstadoEntrar = { ok: boolean; mensagem: string } | null;

/** Envia um link de acesso para o e-mail (sem senha). */
export async function enviarLink(_anterior: EstadoEntrar, dados: FormData): Promise<EstadoEntrar> {
  if (!supabaseConfigurado()) {
    return { ok: false, mensagem: "O banco de dados ainda não foi ligado. Fale com o administrador." };
  }

  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, mensagem: "Digite um e-mail válido." };
  }

  const voltar = caminhoSeguro(dados.get("voltar"));
  const h = await headers();
  const origem = h.get("origin") ?? `https://${h.get("host")}`;
  const destino = new URL("/auth/confirmar", origem);
  destino.searchParams.set("voltar", voltar);

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: destino.toString() },
  });

  if (error) {
    const muitas = error.status === 429 || /rate/i.test(error.message);
    return {
      ok: false,
      mensagem: muitas
        ? "Muitas tentativas seguidas. Espere um minuto e tente de novo."
        : "Não foi possível enviar o link agora. Tente de novo em instantes.",
    };
  }

  return { ok: true, mensagem: `Pronto! Enviamos um link de acesso para ${email}. Abra o e-mail e toque no link.` };
}

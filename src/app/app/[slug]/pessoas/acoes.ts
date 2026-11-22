"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/components/form-acao";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import { PAPEIS, type Papel } from "@/lib/frentes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/sessao";
import { emailValido } from "@/lib/textos";
import { convidarPorEmail } from "@/lib/acesso";

function ePapel(valor: unknown): valor is Papel {
  return typeof valor === "string" && valor in PAPEIS;
}

export async function convidar(slug: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  const papel = dados.get("papel");
  if (!emailValido(email)) return { ok: false, mensagem: "Digite um e-mail válido." };
  if (!ePapel(papel)) return { ok: false, mensagem: "Escolha o papel da pessoa." };

  const supabase = await criarClienteServidor();
  const { data: pessoas } = await supabase.rpc("pessoas_da_org", { org: empresa.id });
  if ((pessoas ?? []).some((p: { email: string }) => p.email === email)) {
    return { ok: false, mensagem: `${email} já faz parte da empresa. Para mudar o papel, use a lista acima.` };
  }

  const eu = await usuarioAtual();
  const { error } = await supabase.from("convites").insert({ org_id: empresa.id, email, papel, criado_por: eu.id });
  if (error) {
    if (error.code === "23505") return { ok: false, mensagem: `Já existe um convite para ${email}.` };
    return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível convidar. Tente de novo.") };
  }

  revalidatePath(`/app/${slug}/pessoas`);
  const convite = await convidarPorEmail(email, empresa.nome);
  return {
    ok: true,
    mensagem:
      convite === "enviado"
        ? `Convite enviado para ${email}. A pessoa recebe um e-mail para criar a senha e entrar.`
        : convite === "ja-tem-conta"
          ? `${email} já tem conta no Handback: o acesso a esta empresa aparece no próximo login.`
          : `Convite criado, mas o e-mail não saiu. Peça para ${email} usar “Esqueci minha senha” na tela de entrar.`,
    vez: Date.now(),
  };
}

export async function cancelarConvite(slug: string, id: string): Promise<void> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return;
  const supabase = await criarClienteServidor();
  await supabase.from("convites").delete().eq("id", id).eq("org_id", empresa.id);
  revalidatePath(`/app/${slug}/pessoas`);
}

export async function mudarPapel(slug: string, userId: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const papel = dados.get("papel");
  if (!ePapel(papel)) return { ok: false, mensagem: "Escolha um papel." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("membros").update({ papel }).eq("org_id", empresa.id).eq("user_id", userId);
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível mudar o papel.") };
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: "Papel atualizado.", vez: Date.now() };
}

export async function removerPessoa(slug: string, userId: string): Promise<void> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return;
  const supabase = await criarClienteServidor();
  await supabase.from("membros").delete().eq("org_id", empresa.id).eq("user_id", userId);
  revalidatePath(`/app/${slug}/pessoas`);
}

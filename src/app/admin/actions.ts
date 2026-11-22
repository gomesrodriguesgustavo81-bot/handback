"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";
import { eDonoDaPlataforma } from "@/lib/sessao";
import { eFrente } from "@/lib/frentes";
import { gerarSlug } from "@/lib/caminhos";
import { convidarPorEmail } from "@/lib/acesso";

export type EstadoForm = { ok: boolean; mensagem: string } | null;

/** Cria uma empresa e convida o administrador dela. Só o dono da plataforma. */
export async function criarEmpresa(_anterior: EstadoForm, dados: FormData): Promise<EstadoForm> {
  if (!(await eDonoDaPlataforma())) return { ok: false, mensagem: "Só o dono da plataforma pode criar empresas." };

  const nome = String(dados.get("nome") ?? "").trim();
  const frente = dados.get("frente");
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  const slug = gerarSlug(String(dados.get("slug") ?? "") || nome);

  if (nome.length < 2) return { ok: false, mensagem: "Digite o nome da empresa." };
  if (!eFrente(frente)) return { ok: false, mensagem: "Escolha o tipo de empresa." };
  if (!slug) return { ok: false, mensagem: "O endereço precisa ter letras ou números." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, mensagem: "O e-mail do administrador não parece válido." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("criar_organizacao", {
    p_nome: nome,
    p_slug: slug,
    p_frente: frente,
    p_email_admin: email,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, mensagem: `Já existe uma empresa com o endereço "${slug}".` };
    return { ok: false, mensagem: "Não foi possível criar a empresa. Tente de novo." };
  }

  revalidatePath("/admin");
  if (!email) return { ok: true, mensagem: `Empresa "${nome}" criada.` };
  const convite = await convidarPorEmail(email, nome);
  return {
    ok: true,
    mensagem:
      convite === "enviado"
        ? `Empresa "${nome}" criada. Mandamos um convite para ${email} criar a senha e entrar como administrador.`
        : convite === "ja-tem-conta"
          ? `Empresa "${nome}" criada. ${email} já tem conta: a empresa aparece no próximo acesso.`
          : `Empresa "${nome}" criada, mas o e-mail de convite não saiu. Peça para ${email} usar “Esqueci minha senha” na tela de entrar.`,
  };
}

/** Bloqueia ou libera uma empresa (por exemplo, por falta de pagamento). */
export async function mudarStatus(dados: FormData): Promise<void> {
  if (!(await eDonoDaPlataforma())) return;
  const id = String(dados.get("id") ?? "");
  const ativa = dados.get("ativa") === "true";
  const supabase = await criarClienteServidor();
  await supabase.from("organizacoes").update({ ativa }).eq("id", id);
  revalidatePath("/admin");
}

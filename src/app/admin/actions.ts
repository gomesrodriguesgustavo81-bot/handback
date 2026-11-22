"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { eDonoDaPlataforma, usuarioAtual } from "@/lib/sessao";
import { eFrente } from "@/lib/frentes";
import { gerarSlug } from "@/lib/caminhos";
import { convidarPorEmail, origemDoSite } from "@/lib/acesso";
import { decifrar, enviarPeloGmail, ErroGmail, tokenDeAcesso } from "@/lib/gmail";
import { montarAviso } from "@/lib/emails/montar";
import { dataHoraBR } from "@/lib/textos";

export type EstadoForm = { ok: boolean; mensagem: string } | null;

/** Cria um espaço e convida quem vai administrar. Só o dono do Handback. */
export async function criarEmpresa(_anterior: EstadoForm, dados: FormData): Promise<EstadoForm> {
  if (!(await eDonoDaPlataforma())) return { ok: false, mensagem: "Só o dono do Handback pode criar espaços." };

  const nome = String(dados.get("nome") ?? "").trim();
  const frente = dados.get("frente");
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  const slug = gerarSlug(String(dados.get("slug") ?? "") || nome);

  if (nome.length < 2) return { ok: false, mensagem: "Digite o nome do espaço." };
  if (!eFrente(frente)) return { ok: false, mensagem: "Escolha o tipo de uso." };
  if (!slug) return { ok: false, mensagem: "O endereço precisa ter letras ou números." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, mensagem: "O e-mail de quem vai administrar não parece válido." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("criar_organizacao", { p_nome: nome, p_slug: slug, p_frente: frente, p_email_admin: email });
  if (error) {
    if (error.code === "23505") return { ok: false, mensagem: `Já existe um espaço com o endereço "${slug}".` };
    return { ok: false, mensagem: "Não foi possível criar o espaço. Tente de novo." };
  }

  revalidatePath("/admin");
  if (!email) return { ok: true, mensagem: `Espaço "${nome}" criado.` };
  const convite = await convidarPorEmail(email, nome);
  return {
    ok: true,
    mensagem:
      convite === "enviado"
        ? `Espaço "${nome}" criado. Mandamos um convite para ${email} criar a senha e entrar como administrador.`
        : convite === "ja-tem-conta"
          ? `Espaço "${nome}" criado. ${email} já tem conta: o espaço aparece no próximo acesso.`
          : `Espaço "${nome}" criado, mas o e-mail de convite não saiu. Peça para ${email} usar “Esqueci minha senha” na tela de entrar.`,
  };
}

/** Bloqueia ou libera um espaço. */
export async function mudarStatus(dados: FormData): Promise<void> {
  if (!(await eDonoDaPlataforma())) return;
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("espacos_da_plataforma");
  const e = ((data ?? []) as { id: string; situacao: string; teste_ate: string | null }[]).find((x) => x.id === String(dados.get("id") ?? ""));
  if (!e) return;
  await supabase.rpc("mudar_situacao_espaco", { p_org: e.id, p_ativa: dados.get("ativa") === "true", p_situacao: e.situacao, p_teste_ate: e.teste_ate });
  revalidatePath("/admin");
}

/** Muda a situação de cobrança de um espaço (por enquanto todos ficam "liberado"). */
export async function mudarSituacao(id: string, _a: EstadoForm, dados: FormData): Promise<EstadoForm> {
  if (!(await eDonoDaPlataforma())) return { ok: false, mensagem: "Só o dono do Handback." };
  const situacao = String(dados.get("situacao") ?? "liberado");
  const ate = String(dados.get("teste_ate") ?? "").trim() || null;
  if (situacao === "teste" && !ate) return { ok: false, mensagem: "Escolha até quando vai o teste." };
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("espacos_da_plataforma");
  const e = ((data ?? []) as { id: string; ativa: boolean }[]).find((x) => x.id === id);
  if (!e) return { ok: false, mensagem: "Espaço não encontrado." };
  const { error } = await supabase.rpc("mudar_situacao_espaco", { p_org: id, p_ativa: e.ativa, p_situacao: situacao, p_teste_ate: situacao === "teste" ? ate : null });
  if (error) return { ok: false, mensagem: error.message };
  revalidatePath("/admin");
  return { ok: true, mensagem: "Situação salva." };
}

/**
 * Acesso de emergência: o dono entra no espaço por 4 horas, com um motivo.
 * Quem administra o espaço é avisado por e-mail na hora (pelo Gmail do dono)
 * e o motivo vai para o registro de atividades do espaço.
 */
export async function entrarEmEmergencia(id: string, slug: string, _a: EstadoForm, dados: FormData): Promise<EstadoForm> {
  if (!(await eDonoDaPlataforma())) return { ok: false, mensagem: "Só o dono do Handback." };
  const motivo = String(dados.get("motivo") ?? "").trim();
  if (motivo.length < 10) return { ok: false, mensagem: "Escreva o motivo (pelo menos 10 letras). Ele vai para o cliente." };
  const eu = await usuarioAtual();
  const admin = criarClienteAdmin();
  if (!admin) return { ok: false, mensagem: "O servidor ainda não está pronto." };
  const { data: gmail } = await admin.from("contas_gmail").select("email, token_cifrado, invalida").eq("user_id", eu.id).maybeSingle();
  if (!gmail || gmail.invalida) {
    return { ok: false, mensagem: "Conecte o seu Gmail antes: o cliente precisa ser avisado por e-mail. Use o link “Conectar meu Gmail” acima." };
  }
  const supabase = await criarClienteServidor();
  const { data: lista } = await supabase.rpc("espacos_da_plataforma");
  const e = ((lista ?? []) as { id: string; nome: string; administradores: string[] }[]).find((x) => x.id === id);
  if (!e) return { ok: false, mensagem: "Espaço não encontrado." };
  if (!e.administradores.length) return { ok: false, mensagem: "Este espaço não tem ninguém administrando para ser avisado." };

  const { data: ate, error } = await supabase.rpc("acesso_de_emergencia", { p_org: id, p_motivo: motivo });
  if (error) return { ok: false, mensagem: error.message };
  try {
    const msg = montarAviso(gmail.email, {
      para: e.administradores,
      assunto: `Acesso de emergência do Handback a ${e.nome}`,
      titulo: "O Handback entrou no seu espaço",
      paragrafos: [
        `A equipe do Handback abriu um acesso de emergência a ${e.nome}, válido até ${dataHoraBR(String(ate))}.`,
        `Motivo: ${motivo}`,
        "Tudo o que for aberto fica no seu Registro de atividades. Se você não reconhece este motivo, responda este e-mail.",
      ],
      site: await origemDoSite(),
    });
    await enviarPeloGmail(await tokenDeAcesso(decifrar(gmail.token_cifrado)), msg.raw);
  } catch (x) {
    // Sem o aviso, o acesso não fica valendo.
    await supabase.rpc("sair_do_suporte", { p_org: id });
    const m = x instanceof ErroGmail ? x.message : "o e-mail de aviso não saiu";
    return { ok: false, mensagem: `Não entrou: ${m}. O cliente precisa ser avisado antes.` };
  }
  revalidatePath("/", "layout");
  redirect(`/app/${slug}`);
}

/** O dono encerra o próprio acesso de suporte ou de emergência. */
export async function sairDoSuporte(id: string): Promise<void> {
  if (!(await eDonoDaPlataforma())) return;
  const supabase = await criarClienteServidor();
  await supabase.rpc("sair_do_suporte", { p_org: id });
  revalidatePath("/", "layout");
  redirect("/admin");
}

/** O dono vira administrador de um espaço sem ninguém dentro (um espaço de teste dele). */
export async function assumirEspaco(id: string, slug: string): Promise<void> {
  if (!(await eDonoDaPlataforma())) return;
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("assumir_espaco_vazio", { p_org: id });
  if (error) return;
  revalidatePath("/", "layout");
  redirect(`/app/${slug}`);
}

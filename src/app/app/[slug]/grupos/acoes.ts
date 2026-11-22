"use server";

import { revalidatePath } from "next/cache";
import { turmaAtual } from "@/lib/turma";
import { redirect } from "next/navigation";
import type { Resultado } from "@/components/form-acao";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { emailValido, lerEmails } from "@/lib/textos";
import { lerListaDePessoas } from "@/lib/nomes";

type Supabase = Awaited<ReturnType<typeof criarClienteServidor>>;

function lerGrupo(dados: FormData) {
  return {
    nome: String(dados.get("nome") ?? "").trim(),
    tema: String(dados.get("tema") ?? "").trim(),
    observacoes: String(dados.get("observacoes") ?? "").trim(),
    emails: lerEmails(String(dados.get("emails") ?? "")),
  };
}

function validar(g: ReturnType<typeof lerGrupo>): string | null {
  if (!g.nome) return "Escreva o nome.";
  if (g.emails.invalidos.length) return `Estes e-mails não parecem válidos: ${g.emails.invalidos.join(", ")}.`;
  if (g.emails.validos.length > 50) return "No máximo 50 e-mails por cadastro.";
  return null;
}

/** Confere se algum e-mail já entrega por outro grupo da mesma turma. */
async function emailsEmOutroGrupo(supabase: Supabase, turmaId: string, emails: string[], grupoId?: string) {
  if (!emails.length) return null;
  let consulta = supabase.from("integrantes").select("email, grupos(nome)").eq("turma_id", turmaId).in("email", emails);
  if (grupoId) consulta = consulta.neq("grupo_id", grupoId);
  const { data } = await consulta;
  if (!data?.length) return null;
  return data
    .map((i) => {
      const grupo = i.grupos as unknown as { nome: string } | null;
      return `${i.email} (já está em “${grupo?.nome ?? "outro cadastro"}”)`;
    })
    .join(", ");
}

/** Deixa os integrantes do grupo exatamente iguais à lista de e-mails. */
async function sincronizarEmails(supabase: Supabase, orgId: string, grupoId: string, emails: string[]) {
  const { data: atuais } = await supabase.from("integrantes").select("id, email").eq("grupo_id", grupoId);
  const sair = (atuais ?? []).filter((i) => !emails.includes(i.email)).map((i) => i.id);
  const entrar = emails.filter((e) => !(atuais ?? []).some((i) => i.email === e));
  if (sair.length) {
    const { error } = await supabase.from("integrantes").delete().in("id", sair);
    if (error) return error;
  }
  if (entrar.length) {
    const { error } = await supabase
      .from("integrantes")
      .insert(entrar.map((email) => ({ org_id: orgId, grupo_id: grupoId, email })));
    if (error) return error;
  }
  return null;
}

function erroDoBanco(erro: { code?: string; message?: string }, nome: string): string {
  if (erro.code === "23505") return `Já existe um cadastro chamado “${nome}”, ou um dos e-mails já está em outro.`;
  return mensagemDeErro(erro, "Não foi possível salvar. Tente de novo.");
}

export async function criarGrupo(slug: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const g = lerGrupo(dados);
  const invalido = validar(g);
  if (invalido) return { ok: false, mensagem: invalido };

  const supabase = await criarClienteServidor();
  const turma = await turmaAtual(empresa.id);
  if (!turma) return { ok: false, mensagem: "Crie uma turma antes." };
  const repetidos = await emailsEmOutroGrupo(supabase, turma.id, g.emails.validos);
  if (repetidos) return { ok: false, mensagem: `Cada e-mail só pode estar em um cadastro: ${repetidos}.` };

  const { data, error } = await supabase
    .from("grupos")
    .insert({ org_id: empresa.id, turma_id: turma.id, nome: g.nome, tema: g.tema, observacoes: g.observacoes })
    .select("id")
    .single();
  if (error) return { ok: false, mensagem: erroDoBanco(error, g.nome) };

  const erroEmails = await sincronizarEmails(supabase, empresa.id, data.id, g.emails.validos);
  if (erroEmails) {
    await supabase.from("grupos").delete().eq("id", data.id);
    return { ok: false, mensagem: erroDoBanco(erroEmails, g.nome) };
  }

  revalidatePath(`/app/${slug}`, "layout");
  return {
    ok: true,
    mensagem: `“${g.nome}” cadastrado com ${g.emails.validos.length} e-mail(s).`,
    vez: Date.now(),
  };
}

export async function salvarGrupo(slug: string, id: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const g = lerGrupo(dados);
  const invalido = validar(g);
  if (invalido) return { ok: false, mensagem: invalido };

  const supabase = await criarClienteServidor();
  const { data: atual } = await supabase.from("grupos").select("turma_id").eq("id", id).eq("org_id", empresa.id).maybeSingle();
  if (!atual) return { ok: false, mensagem: "Não foi possível salvar (sem permissão ou item apagado)." };
  const repetidos = await emailsEmOutroGrupo(supabase, atual.turma_id, g.emails.validos, id);
  if (repetidos) return { ok: false, mensagem: `Cada e-mail só pode estar em um cadastro: ${repetidos}.` };

  const { data, error } = await supabase
    .from("grupos")
    .update({ nome: g.nome, tema: g.tema, observacoes: g.observacoes, ativo: dados.get("ativo") === "on" })
    .eq("id", id)
    .eq("org_id", empresa.id)
    .select("id");
  if (error) return { ok: false, mensagem: erroDoBanco(error, g.nome) };
  if (!data?.length) return { ok: false, mensagem: "Não foi possível salvar (sem permissão ou item apagado)." };

  const erroEmails = await sincronizarEmails(supabase, empresa.id, id, g.emails.validos);
  if (erroEmails) return { ok: false, mensagem: erroDoBanco(erroEmails, g.nome) };

  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: "Alterações salvas.", vez: Date.now() };
}

export async function apagarGrupo(slug: string, id: string): Promise<void> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return;
  const supabase = await criarClienteServidor();
  await supabase.from("grupos").delete().eq("id", id).eq("org_id", empresa.id);
  revalidatePath(`/app/${slug}`, "layout");
  redirect(`/app/${slug}/grupos`);
}

/**
 * Modo individual: cadastra várias pessoas de uma vez (cada uma vira o próprio
 * “grupo de uma pessoa”). Devolve na 2ª linha da mensagem as linhas que não entraram.
 */
export async function cadastrarEmLote(slug: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const turma = await turmaAtual(empresa.id);
  if (!turma) return { ok: false, mensagem: "Crie uma turma antes." };
  const lidos = lerListaDePessoas(String(dados.get("lista") ?? ""));
  if (!lidos.some((l) => !l.erro)) return { ok: false, mensagem: "Nenhuma linha com e-mail válido." };

  const supabase = await criarClienteServidor();
  const { data: ja } = await supabase.from("integrantes").select("email").eq("turma_id", turma.id).in("email", lidos.map((l) => l.email).filter(Boolean));
  const existentes = new Set((ja ?? []).map((x) => x.email));
  const sobra: string[] = [];
  let feitos = 0;
  for (const l of lidos) {
    const linha = l.email ? `${l.nome}; ${l.email}` : l.nome;
    if (l.erro || !emailValido(l.email)) {
      sobra.push(linha);
      continue;
    }
    if (existentes.has(l.email)) {
      sobra.push(`${linha} (já está cadastrado)`);
      continue;
    }
    const { data: g, error } = await supabase.from("grupos").insert({ org_id: empresa.id, turma_id: turma.id, nome: l.nome }).select("id").single();
    if (error || !g) {
      sobra.push(`${linha} (${error?.code === "23505" ? "nome repetido" : "não foi possível"})`);
      continue;
    }
    const { error: e2 } = await supabase.from("integrantes").insert({ org_id: empresa.id, grupo_id: g.id, email: l.email });
    if (e2) {
      await supabase.from("grupos").delete().eq("id", g.id);
      sobra.push(`${linha} (não foi possível)`);
      continue;
    }
    existentes.add(l.email);
    feitos++;
  }
  revalidatePath(`/app/${slug}`, "layout");
  return {
    ok: feitos > 0,
    mensagem: `${feitos} cadastrado(s).${sobra.length ? " As linhas que não entraram ficaram na caixa." : ""}\n${sobra.join("\n")}`,
    vez: Date.now(),
  };
}

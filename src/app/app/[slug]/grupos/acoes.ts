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
  // Formulário novo: uma linha por pessoa (pessoa_nome + pessoa_email).
  const emailsLinha = dados.getAll("pessoa_email").map((x) => String(x));
  const nomesLinha = dados.getAll("pessoa_nome").map((x) => String(x).trim().replace(/\s+/g, " ").slice(0, 200));
  const nomes = new Map<string, string>();
  emailsLinha.forEach((e, i) => {
    const k = e.trim().toLowerCase();
    if (k && nomesLinha[i] && !nomes.has(k)) nomes.set(k, nomesLinha[i]);
  });
  return {
    nome: String(dados.get("nome") ?? "").trim(),
    tema: String(dados.get("tema") ?? "").trim(),
    observacoes: String(dados.get("observacoes") ?? "").trim(),
    emails: lerEmails(emailsLinha.length ? emailsLinha.join("\n") : String(dados.get("emails") ?? "")),
    nomes,
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
async function sincronizarEmails(supabase: Supabase, orgId: string, grupoId: string, emails: string[], nomes = new Map<string, string>()) {
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
      .insert(entrar.map((email) => ({ org_id: orgId, grupo_id: grupoId, email, nome: nomes.get(email) ?? "" })));
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

  const erroEmails = await sincronizarEmails(supabase, empresa.id, data.id, g.emails.validos, g.nomes);
  if (erroEmails) {
    await supabase.from("grupos").delete().eq("id", data.id);
    return { ok: false, mensagem: erroDoBanco(erroEmails, g.nome) };
  }
  const movidos = await moverParaGrupo(supabase, empresa.id, turma.id, data.id, dados.getAll("membro").map(String));

  revalidatePath(`/app/${slug}`, "layout");
  const total = g.emails.validos.length + movidos;
  return {
    ok: true,
    mensagem: `“${g.nome}” cadastrado com ${total} ${total === 1 ? "pessoa" : "pessoas"}.`,
    vez: Date.now(),
  };
}

/**
 * Leva pessoas que já estão cadastradas (ex.: alunos que vieram sozinhos do
 * Moodle) para outro cadastro. O cadastro de onde saíram, se ficar vazio,
 * vai para "Apagadas" (com as entregas guardadas). O Moodle não desfaz:
 * ele só muda de lugar quem está num cadastro que veio de lá.
 */
async function moverParaGrupo(supabase: Supabase, orgId: string, turmaId: string, grupoId: string, ids: string[]): Promise<number> {
  const validos = [...new Set(ids)].filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200);
  if (!validos.length) return 0;
  const { data: pessoas } = await supabase.from("integrantes").select("id, grupo_id").in("id", validos).eq("org_id", orgId).eq("turma_id", turmaId);
  if (!pessoas?.length) return 0;
  const { error } = await supabase.from("integrantes").update({ grupo_id: grupoId }).in("id", pessoas.map((p) => p.id));
  if (error) return 0;
  const origens = [...new Set(pessoas.map((p) => p.grupo_id as string))].filter((x) => x !== grupoId);
  if (origens.length) {
    const { data: ainda } = await supabase.from("integrantes").select("grupo_id").in("grupo_id", origens);
    const comGente = new Set((ainda ?? []).map((x) => x.grupo_id as string));
    const vazios = origens.filter((x) => !comGente.has(x));
    if (vazios.length) await supabase.from("grupos").update({ escondido: true, ativo: false }).in("id", vazios).eq("org_id", orgId);
  }
  return pessoas.length;
}

/**
 * Adiciona uma pessoa: numa equipe que já existe, junto com alguém que está
 * sozinho, ou sozinha (entrega individual, vira um cadastro com o nome dela).
 */
export async function adicionarPessoa(slug: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra pode mudar isso." };
  const turma = await turmaAtual(empresa.id);
  if (!turma) return { ok: false, mensagem: "Crie uma turma antes." };
  const nome = String(dados.get("nome") ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  const destino = String(dados.get("destino") ?? "sozinha");
  if (nome.length < 2) return { ok: false, mensagem: "Escreva o nome da pessoa." };
  if (!emailValido(email)) return { ok: false, mensagem: "Digite um e-mail válido." };
  const supabase = await criarClienteServidor();
  const repetidos = await emailsEmOutroGrupo(supabase, turma.id, [email]);
  if (repetidos) return { ok: false, mensagem: `Esse e-mail já está num cadastro: ${repetidos}.` };

  if (destino === "sozinha") {
    const { data: existentes } = await supabase.from("grupos").select("nome").eq("turma_id", turma.id);
    const usados = new Set((existentes ?? []).map((g) => String(g.nome).trim().toLowerCase()));
    let nomeGrupo = nome.slice(0, 110);
    for (let n = 2; usados.has(nomeGrupo.toLowerCase()); n++) nomeGrupo = `${nome.slice(0, 110)} (${n})`;
    const { data: g, error } = await supabase.from("grupos").insert({ org_id: empresa.id, turma_id: turma.id, nome: nomeGrupo }).select("id").single();
    if (error || !g) return { ok: false, mensagem: erroDoBanco(error ?? {}, nomeGrupo) };
    const { error: e2 } = await supabase.from("integrantes").insert({ org_id: empresa.id, turma_id: turma.id, grupo_id: g.id, email, nome });
    if (e2) {
      await supabase.from("grupos").delete().eq("id", g.id);
      return { ok: false, mensagem: mensagemDeErro(e2, "Não foi possível salvar. Tente de novo.") };
    }
    revalidatePath(`/app/${slug}`, "layout");
    return { ok: true, mensagem: `${nome} entrou, com entrega individual.`, vez: Date.now() };
  }

  if (!/^[0-9a-f-]{36}$/i.test(destino)) return { ok: false, mensagem: "Escolha onde a pessoa entra." };
  const { data: g } = await supabase.from("grupos").select("id, nome").eq("id", destino).eq("org_id", empresa.id).eq("turma_id", turma.id).maybeSingle();
  if (!g) return { ok: false, mensagem: "Não foi possível salvar (sem permissão ou item apagado)." };
  const { error } = await supabase.from("integrantes").insert({ org_id: empresa.id, turma_id: turma.id, grupo_id: g.id, email, nome });
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: `${nome} entrou em “${g.nome}”.`, vez: Date.now() };
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
  const comEmails = dados.has("emails");
  const repetidos = comEmails ? await emailsEmOutroGrupo(supabase, atual.turma_id, g.emails.validos, id) : null;
  if (repetidos) return { ok: false, mensagem: `Cada e-mail só pode estar em um cadastro: ${repetidos}.` };

  const { data, error } = await supabase
    .from("grupos")
    .update({ nome: g.nome, tema: g.tema, observacoes: g.observacoes, ativo: dados.get("ativo") === "on" })
    .eq("id", id)
    .eq("org_id", empresa.id)
    .select("id");
  if (error) return { ok: false, mensagem: erroDoBanco(error, g.nome) };
  if (!data?.length) return { ok: false, mensagem: "Não foi possível salvar (sem permissão ou item apagado)." };

  if (comEmails) {
    const erroEmails = await sincronizarEmails(supabase, empresa.id, id, g.emails.validos);
    if (erroEmails) return { ok: false, mensagem: erroDoBanco(erroEmails, g.nome) };
  }

  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: "Alterações salvas.", vez: Date.now() };
}

export async function apagarGrupo(slug: string, id: string): Promise<void> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return;
  const supabase = await criarClienteServidor();
  const { data: g } = await supabase.from("grupos").select("moodle_id").eq("id", id).eq("org_id", empresa.id).maybeSingle();
  if (g?.moodle_id) {
    // Veio do Moodle: só esconde, senão a próxima busca traria de volta.
    await supabase.from("grupos").update({ escondido: true, ativo: false }).eq("id", id).eq("org_id", empresa.id);
  } else {
    await supabase.from("grupos").delete().eq("id", id).eq("org_id", empresa.id);
  }
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

/** Corrige o nome ou a matrícula de um integrante (salva sozinho na tela). */
export async function salvarIntegrante(slug: string, id: string, campo: "nome" | "matricula", valorBruto: string): Promise<{ ok: boolean; mensagem: string }> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra pode mudar isso." };
  if (!/^[0-9a-f-]{36}$/i.test(id) || (campo !== "nome" && campo !== "matricula")) return { ok: false, mensagem: "Campo desconhecido." };
  const valor = String(valorBruto ?? "").trim().replace(/\s+/g, " ");
  if (campo === "nome" && (valor.length < 2 || valor.length > 200)) return { ok: false, mensagem: "Escreva o nome (de 2 a 200 letras)." };
  if (campo === "matricula" && valor.length > 40) return { ok: false, mensagem: "No máximo 40 caracteres." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("integrantes").update({ [campo]: valor }).eq("id", id).eq("org_id", empresa.id).select("id");
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  if (!data?.length) return { ok: false, mensagem: "Não foi possível salvar (sem permissão ou item apagado)." };
  revalidatePath(`/app/${slug}/grupos`, "layout");
  return { ok: true, mensagem: "Salvo." };
}

/** Troca só o nome da equipe (direto na lista). */
export async function renomearGrupo(slug: string, id: string, valorBruto: string): Promise<{ ok: boolean; mensagem: string }> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra pode mudar isso." };
  const nome = String(valorBruto ?? "").trim().replace(/\s+/g, " ");
  if (!nome || nome.length > 120) return { ok: false, mensagem: "Escreva o nome (até 120 letras)." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("grupos").update({ nome }).eq("id", id).eq("org_id", empresa.id).select("id");
  if (error) return { ok: false, mensagem: erroDoBanco(error, nome) };
  if (!data?.length) return { ok: false, mensagem: "Não foi possível salvar (sem permissão ou item apagado)." };
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: "Salvo." };
}

/** Traz de volta uma equipe apagada (as do Moodle ficam só escondidas). */
export async function restaurarGrupo(slug: string, id: string): Promise<void> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return;
  const supabase = await criarClienteServidor();
  await supabase.from("grupos").update({ escondido: false, ativo: true }).eq("id", id).eq("org_id", empresa.id);
  revalidatePath(`/app/${slug}`, "layout");
}

/** Coloca uma pessoa (nome e e-mail) num cadastro. */
export async function adicionarIntegrante(slug: string, grupoId: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra pode mudar isso." };
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  const nome = String(dados.get("nome") ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
  if (!emailValido(email)) return { ok: false, mensagem: "Digite um e-mail válido." };
  const supabase = await criarClienteServidor();
  const { data: g } = await supabase.from("grupos").select("turma_id").eq("id", grupoId).eq("org_id", empresa.id).maybeSingle();
  if (!g) return { ok: false, mensagem: "Não foi possível salvar (sem permissão ou item apagado)." };
  const repetidos = await emailsEmOutroGrupo(supabase, g.turma_id, [email]);
  if (repetidos) return { ok: false, mensagem: `Esse e-mail já está num cadastro: ${repetidos}.` };
  const { error } = await supabase.from("integrantes").insert({ org_id: empresa.id, turma_id: g.turma_id, grupo_id: grupoId, email, nome });
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: `${nome || email} entrou.`, vez: Date.now() };
}

/** Tira uma pessoa do cadastro (ela para de receber a devolutiva). */
export async function removerIntegrante(slug: string, id: string): Promise<void> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return;
  const supabase = await criarClienteServidor();
  await supabase.from("integrantes").delete().eq("id", id).eq("org_id", empresa.id);
  revalidatePath(`/app/${slug}`, "layout");
}

/** Apaga várias de uma vez (as do Moodle ficam só escondidas, para poder voltar). */
export async function apagarGrupos(slug: string, ids: string[]): Promise<{ ok: boolean; mensagem: string }> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra pode apagar." };
  const validos = [...new Set(ids)].filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500);
  if (!validos.length) return { ok: false, mensagem: "Nada selecionado." };
  const supabase = await criarClienteServidor();
  const { data: gs } = await supabase.from("grupos").select("id, moodle_id").in("id", validos).eq("org_id", empresa.id);
  const doMoodle = (gs ?? []).filter((g) => g.moodle_id).map((g) => g.id as string);
  const meus = (gs ?? []).filter((g) => !g.moodle_id).map((g) => g.id as string);
  if (doMoodle.length) await supabase.from("grupos").update({ escondido: true, ativo: false }).in("id", doMoodle).eq("org_id", empresa.id);
  if (meus.length) await supabase.from("grupos").delete().in("id", meus).eq("org_id", empresa.id);
  revalidatePath(`/app/${slug}`, "layout");
  const n = doMoodle.length + meus.length;
  return { ok: n > 0, mensagem: n === 1 ? "1 apagado." : `${n} apagados.` };
}

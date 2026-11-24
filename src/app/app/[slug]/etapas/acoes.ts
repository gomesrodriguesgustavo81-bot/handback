"use server";

import { ErroClassroom } from "@/lib/classroom/cliente";
import { apagarNoClassroom } from "@/lib/classroom/sincronizar";

import { revalidatePath } from "next/cache";
import { turmaAtual } from "@/lib/turma";
import { redirect } from "next/navigation";
import type { Resultado } from "@/components/form-acao";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeISO, lerData, linhas } from "@/lib/textos";
import { iaConfigurada } from "@/lib/ia/gemini";
import { lerPlanoDeEnsino, type CicloDoPlano } from "@/lib/ia/plano";
import { completarVocabulario } from "@/lib/nomes";
import { after } from "next/server";
import { origemDoSite } from "@/lib/acesso";
import { sincronizarAgenda } from "@/lib/agenda";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/** Depois de mexer numa etapa, a agenda da turma (se ligada) se atualiza sozinha. */
async function atualizarAgendaDepois(orgId: string) {
  const turma = await turmaAtual(orgId);
  if (!turma) return;
  const origem = await origemDoSite();
  after(async () => {
    const admin = criarClienteAdmin();
    if (!admin) return;
    const { data } = await admin.from("turmas").select("agenda_por").eq("id", turma.id).maybeSingle();
    if (data?.agenda_por) await sincronizarAgenda(admin, turma.id, origem).catch(() => undefined);
  });
}

function lerEtapa(dados: FormData) {
  return {
    numero: Number(dados.get("numero")),
    titulo: String(dados.get("titulo") ?? "").trim(),
    data: lerData(dados.get("data")),
    recebe_de: lerData(dados.get("recebe_de")),
    recebe_ate: lerData(dados.get("recebe_ate")),
    entregaveis: linhas(String(dados.get("entregaveis") ?? "")),
    criterios: String(dados.get("criterios") ?? "").trim(),
    observacoes_ia: String(dados.get("observacoes_ia") ?? "").trim(),
  };
}

function validar(e: ReturnType<typeof lerEtapa>): string | null {
  if (!Number.isInteger(e.numero) || e.numero < 1 || e.numero > 9999) return "O número precisa ser um número inteiro (1, 2, 3…).";
  if (e.titulo.length < 2) return "Escreva um título (pelo menos 2 letras).";
  if (e.recebe_de && e.recebe_ate && e.recebe_de > e.recebe_ate) return "A data final de recebimento precisa ser depois da inicial.";
  if (e.entregaveis.length > 50) return "O checklist pode ter no máximo 50 itens.";
  return null;
}

function erroDoBanco(erro: { code?: string; message?: string }, numero: number, nomeEtapa: string): string {
  if (erro.code === "23505") return `Já existe ${nomeEtapa.toLowerCase()} com o número ${numero}.`;
  return mensagemDeErro(erro, "Não foi possível salvar. Tente de novo.");
}

export async function criarEtapa(slug: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const etapa = lerEtapa(dados);
  const invalido = validar(etapa);
  if (invalido) return { ok: false, mensagem: invalido };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("etapas")
    .insert({ ...etapa, org_id: empresa.id, turma_id: (await turmaAtual(empresa.id))?.id })
    .select("id")
    .single();
  if (error) return { ok: false, mensagem: erroDoBanco(error, etapa.numero, empresa.vocabulario.etapa) };

  await atualizarAgendaDepois(empresa.id);
  revalidatePath(`/app/${slug}`, "layout");
  redirect(`/app/${slug}/etapas/${data.id}?salvo=1`);
}

export async function salvarEtapa(slug: string, id: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const etapa = lerEtapa(dados);
  const invalido = validar(etapa);
  if (invalido) return { ok: false, mensagem: invalido };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("etapas")
    .update(etapa)
    .eq("id", id)
    .eq("org_id", empresa.id)
    .select("id");
  if (error) return { ok: false, mensagem: erroDoBanco(error, etapa.numero, empresa.vocabulario.etapa) };
  if (!data?.length) return { ok: false, mensagem: "Não foi possível salvar (sem permissão ou item apagado)." };

  await atualizarAgendaDepois(empresa.id);
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: "Alterações salvas.", vez: Date.now() };
}

export async function apagarEtapa(slug: string, id: string): Promise<void> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return;
  const supabase = await criarClienteServidor();
  // Tarefa publicada pelo Handback no Classroom sai de lá também (antes de apagar aqui).
  const admin = criarClienteAdmin();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: daqui } = await supabase.from("etapas").select("id").eq("id", id).eq("org_id", empresa.id).maybeSingle();
  if (!daqui) return;
  if (admin && user) {
    let erro = "";
    try {
      await apagarNoClassroom(admin, id, user.id);
    } catch (e) {
      erro = e instanceof ErroClassroom ? e.message : "Não foi possível apagar a tarefa no Classroom. Tente de novo.";
    }
    if (erro) redirect(`/app/${slug}/etapas/${id}?erro=${encodeURIComponent(erro)}`);
  }
  await supabase.from("etapas").delete().eq("id", id).eq("org_id", empresa.id);
  await atualizarAgendaDepois(empresa.id);
  revalidatePath(`/app/${slug}`, "layout");
  redirect(`/app/${slug}/etapas`);
}

/** Lê o plano de ensino com a IA e devolve os ciclos para revisar (ainda não cria nada). */
export async function lerPlano(slug: string, dados: FormData): Promise<{ ok: boolean; mensagem: string; ciclos?: CicloDoPlano[] }> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra cria as aulas." };
  if (!iaConfigurada()) return { ok: false, mensagem: "A IA ainda não foi configurada no servidor." };
  const texto = String(dados.get("texto") ?? "").slice(0, 100_000);
  const f = dados.get("arquivo");
  let arquivo: { dados: Uint8Array; nome: string; tipo: string } | null = null;
  if (f instanceof File && f.size > 0) {
    if (f.size > 4 * 1024 * 1024) return { ok: false, mensagem: "O arquivo passa de 4 MB. Cole o texto do plano no lugar." };
    arquivo = { dados: new Uint8Array(await f.arrayBuffer()), nome: f.name, tipo: f.type };
  }
  if (!texto.trim() && !arquivo) return { ok: false, mensagem: "Cole o texto do plano de ensino ou escolha o arquivo." };
  try {
    const ciclos = await lerPlanoDeEnsino(texto, arquivo, completarVocabulario(empresa.vocabulario).etapa, hojeISO());
    if (!ciclos.length) return { ok: false, mensagem: "A IA não achou entregas nesse plano. Confira se é o plano certo ou cole o trecho do cronograma." };
    return { ok: true, mensagem: "", ciclos };
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message.split("\n")[0] : "Não foi possível ler o plano. Tente de novo." };
  }
}

/** Cria os ciclos revisados. Números que já existem vão para depois do último. */
export async function criarCiclosDoPlano(slug: string, ciclos: CicloDoPlano[]): Promise<{ ok: boolean; mensagem: string }> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra cria as aulas." };
  const turma = await turmaAtual(empresa.id);
  if (!turma) return { ok: false, mensagem: "Crie uma turma antes." };
  const supabase = await criarClienteServidor();
  const { data: ja } = await supabase.from("etapas").select("numero").eq("turma_id", turma.id);
  const usados = new Set((ja ?? []).map((e) => Number(e.numero)));
  let proximo = Math.max(0, ...usados) + 1;
  const linhasNovas = [];
  for (const c of ciclos.slice(0, 60)) {
    const titulo = String(c.titulo ?? "").trim().slice(0, 200);
    if (titulo.length < 2) continue;
    let numero = Number(c.numero);
    if (!Number.isInteger(numero) || numero < 1 || numero > 9999 || usados.has(numero)) numero = proximo++;
    usados.add(numero);
    if (numero >= proximo) proximo = numero + 1;
    const d = (x: string) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x ?? "")) ? x : null);
    let de = d(c.recebe_de);
    const ate = d(c.recebe_ate);
    if (de && ate && de > ate) de = null;
    linhasNovas.push({
      org_id: empresa.id,
      turma_id: turma.id,
      numero,
      titulo,
      data: d(c.data),
      recebe_de: de,
      recebe_ate: ate,
      entregaveis: (c.entregaveis ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 50),
      criterios: String(c.criterios ?? "").trim().slice(0, 5000),
    });
  }
  if (!linhasNovas.length) return { ok: false, mensagem: "Nada para criar." };
  const { error } = await supabase.from("etapas").insert(linhasNovas);
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível criar. Tente de novo.") };
  await atualizarAgendaDepois(empresa.id);
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: `${linhasNovas.length} criad${linhasNovas.length === 1 ? "o" : "os"}.` };
}

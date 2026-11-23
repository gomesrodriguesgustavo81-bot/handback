"use server";

import { revalidatePath } from "next/cache";
import { turmaAtual } from "@/lib/turma";
import { redirect } from "next/navigation";
import type { Resultado } from "@/components/form-acao";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lerData, linhas } from "@/lib/textos";
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
  await supabase.from("etapas").delete().eq("id", id).eq("org_id", empresa.id);
  await atualizarAgendaDepois(empresa.id);
  revalidatePath(`/app/${slug}`, "layout");
  redirect(`/app/${slug}/etapas`);
}

"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/components/form-acao";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import { COLUNAS_ESCOLHAS, colunasDasEscolhas as paraColunas, escolhasDoFormulario, resolverEscolhas, type LinhaEscolhas } from "@/lib/ia/escolhas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";

/** Escolhas da conta inteira (o padrão das turmas). Só quem administra muda. */
export async function salvarEscolhasConta(slug: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("organizacoes").update(paraColunas(escolhasDoFormulario(dados))).eq("id", empresa.id);
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: "Escolhas salvas. Valem para as próximas análises e revisões.", vez: Date.now() };
}

/** Escolhas só desta turma. O que for igual ao da conta volta a "seguir a conta" (muda junto se a conta mudar). */
export async function salvarEscolhasTurma(slug: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const turma = await turmaAtual(empresa.id);
  if (!turma) return { ok: false, mensagem: "Escolha uma turma." };
  const supabase = await criarClienteServidor();
  const { data: conta } = await supabase.from("organizacoes").select(COLUNAS_ESCOLHAS).eq("id", empresa.id).maybeSingle();
  const daConta = paraColunas(resolverEscolhas(conta as LinhaEscolhas | null));
  const novas = paraColunas(escolhasDoFormulario(dados));
  const diferentes = Object.fromEntries(Object.entries(novas).map(([k, v]) => [k, v === daConta[k as keyof typeof daConta] ? null : v]));
  const { error } = await supabase.from("turmas").update(diferentes).eq("id", turma.id).eq("org_id", empresa.id);
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: "Escolhas desta turma salvas.", vez: Date.now() };
}


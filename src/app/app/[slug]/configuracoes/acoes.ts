"use server";

import { revalidatePath } from "next/cache";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import { completarVocabulario, montarVocabulario } from "@/lib/nomes";
import { criarClienteServidor } from "@/lib/supabase/server";

export type Salvo = { ok: boolean; mensagem: string };

const PALAVRAS = ["organizacao", "espaco", "etapa", "grupo", "pessoa", "avaliador"] as const;
const CONCEITOS = ["EXCELENTE", "BOM", "REGULAR", "RUIM"] as const;

/**
 * Salva um campo das Configurações assim que a pessoa termina de mexer
 * (sem botão de salvar). Cada campo tem a sua regra; o banco confere a
 * permissão de novo.
 */
export async function salvarConfiguracao(slug: string, campo: string, valorBruto: string): Promise<Salvo> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra pode mudar isso." };
  const valor = valorBruto.trim();
  const supabase = await criarClienteServidor();
  let mudanca: Record<string, unknown>;

  if (campo === "nome") {
    if (valor.length < 2 || valor.length > 120) return { ok: false, mensagem: "Escreva o nome (de 2 a 120 letras)." };
    mudanca = { nome: valor };
  } else if (campo.startsWith("palavra_")) {
    const chave = campo.slice(8) as (typeof PALAVRAS)[number];
    if (!PALAVRAS.includes(chave)) return { ok: false, mensagem: "Campo desconhecido." };
    if (!valor || valor.length > 40) return { ok: false, mensagem: "Escreva uma palavra (até 40 letras)." };
    const atual = completarVocabulario(empresa.vocabulario);
    mudanca = {
      vocabulario: montarVocabulario({
        organizacao: atual.organizacao,
        espaco: atual.espaco,
        etapa: atual.etapa,
        grupo: atual.grupo,
        pessoa: atual.pessoa,
        avaliador: atual.avaliador,
        [chave]: valor,
      }),
    };
  } else if (campo === "etiqueta_assunto") {
    const etiqueta = valor.replace(/^\[|\]$/g, "").trim();
    if (!etiqueta || etiqueta.length > 40) return { ok: false, mensagem: "Escreva a etiqueta do assunto (ex.: ENTREGA)." };
    mudanca = { etiqueta_assunto: etiqueta };
  } else if (campo === "modo_entrega") {
    mudanca = { modo_entrega: valor === "automatico" ? "automatico" : "confirmar" };
  } else if (campo === "assuntos_ignorar") {
    if (valor.length > 2000) return { ok: false, mensagem: "A lista está grande demais." };
    mudanca = { assuntos_ignorar: valor };
  } else if (campo.startsWith("conceito_")) {
    const c = campo.slice(9) as (typeof CONCEITOS)[number];
    if (!CONCEITOS.includes(c)) return { ok: false, mensagem: "Conceito desconhecido." };
    if (!valor || valor.length > 1000) return { ok: false, mensagem: `Descreva o conceito ${c} (até 1.000 letras).` };
    const { data: org } = await supabase.from("organizacoes").select("conceitos").eq("id", empresa.id).single();
    mudanca = { conceitos: { ...((org?.conceitos as Record<string, string>) ?? {}), [c]: valor } };
  } else if (campo === "regra_checklist") {
    if (!["rigida", "flexivel", "livre"].includes(valor)) return { ok: false, mensagem: "Escolha a regra do checklist." };
    mudanca = { regra_checklist: valor };
  } else if (campo === "exemplos_devolutiva") {
    if (valor.length > 20000) return { ok: false, mensagem: "Os exemplos estão grandes demais." };
    mudanca = { exemplos_devolutiva: valor };
  } else if (campo === "enviar_conceito") {
    mudanca = { enviar_conceito: valor === "sim" };
  } else if (campo === "exigir_duas_etapas") {
    mudanca = { exigir_duas_etapas: valor !== "nao" };
  } else {
    return { ok: false, mensagem: "Campo desconhecido." };
  }

  const { data, error } = await supabase.from("organizacoes").update(mudanca).eq("id", empresa.id).select("id");
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  if (!data?.length) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  revalidatePath("/app", "layout");
  return { ok: true, mensagem: "Salvo" };
}

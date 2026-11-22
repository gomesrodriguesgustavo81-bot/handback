"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/components/form-acao";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import type { Vocabulario } from "@/lib/frentes";
import { criarClienteServidor } from "@/lib/supabase/server";

const CHAVES: (keyof Vocabulario)[] = ["etapa", "etapas", "avaliador", "avaliadores", "grupo", "grupos"];

export async function salvarAjustes(slug: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };

  const nome = String(dados.get("nome") ?? "").trim();
  if (nome.length < 2) return { ok: false, mensagem: "Escreva o nome da empresa." };

  const vocabulario = {} as Vocabulario;
  for (const chave of CHAVES) {
    const palavra = String(dados.get(chave) ?? "").trim();
    if (!palavra || palavra.length > 40) return { ok: false, mensagem: "Preencha todas as palavras (até 40 letras cada)." };
    vocabulario[chave] = palavra;
  }

  const etiqueta = String(dados.get("etiqueta_assunto") ?? "").trim().replace(/^\[|\]$/g, "");
  if (!etiqueta || etiqueta.length > 40) return { ok: false, mensagem: "Escreva a etiqueta do assunto (ex.: ENTREGA)." };
  const modo = dados.get("modo_entrega") === "automatico" ? "automatico" : "confirmar";
  const assuntosIgnorar = String(dados.get("assuntos_ignorar") ?? "").trim();
  if (assuntosIgnorar.length > 2000) return { ok: false, mensagem: "A lista de assuntos a ignorar está grande demais." };

  const conceitos: Record<string, string> = {};
  for (const c of ["EXCELENTE", "BOM", "REGULAR", "RUIM"]) {
    const t = String(dados.get(`conceito_${c}`) ?? "").trim();
    if (!t || t.length > 1000) return { ok: false, mensagem: `Descreva o conceito ${c} (até 1.000 letras).` };
    conceitos[c] = t;
  }
  const regra = String(dados.get("regra_checklist") ?? "flexivel");
  if (!["rigida", "flexivel", "livre"].includes(regra)) return { ok: false, mensagem: "Escolha a regra do checklist." };
  const exemplos = String(dados.get("exemplos_devolutiva") ?? "").trim();
  if (exemplos.length > 20000) return { ok: false, mensagem: "Os exemplos de devolutiva estão grandes demais." };

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("organizacoes")
    .update({
      nome,
      vocabulario,
      etiqueta_assunto: etiqueta,
      modo_entrega: modo,
      assuntos_ignorar: assuntosIgnorar,
      conceitos,
      regra_checklist: regra,
      exemplos_devolutiva: exemplos,
      enviar_conceito: dados.get("enviar_conceito") === "sim",
    })
    .eq("id", empresa.id)
    .select("id");
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  if (!data?.length) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };

  revalidatePath("/app", "layout");
  return { ok: true, mensagem: "Ajustes salvos.", vez: Date.now() };
}

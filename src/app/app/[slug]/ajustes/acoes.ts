"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/components/form-acao";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import { montarVocabulario, type Modo } from "@/lib/nomes";
import { criarClienteServidor } from "@/lib/supabase/server";

export async function salvarAjustes(slug: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };

  const nome = String(dados.get("nome") ?? "").trim();
  if (nome.length < 2) return { ok: false, mensagem: "Escreva o nome da empresa." };

  const palavras = {
    etapa: String(dados.get("etapa") ?? ""),
    grupo: String(dados.get("grupo") ?? ""),
    espaco: String(dados.get("espaco") ?? ""),
    pessoa: String(dados.get("pessoa") ?? ""),
    avaliador: String(dados.get("avaliador") ?? ""),
  };
  if (Object.values(palavras).some((x) => !x.trim() || x.trim().length > 40)) {
    return { ok: false, mensagem: "Preencha todas as palavras (até 40 letras cada)." };
  }
  const vocabulario = montarVocabulario(palavras);

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
      exigir_duas_etapas: dados.get("exigir_duas_etapas") !== "nao",
    })
    .eq("id", empresa.id)
    .select("id");
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  if (!data?.length) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };

  revalidatePath("/app", "layout");
  return { ok: true, mensagem: "Ajustes salvos.", vez: Date.now() };
}

/** Cria uma turma (programa, projeto…) nova. */
export async function criarTurma(slug: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const nome = String(dados.get("nome") ?? "").trim();
  const modo: Modo = dados.get("modo") === "individual" ? "individual" : "grupos";
  if (!nome || nome.length > 120) return { ok: false, mensagem: "Escreva o nome (até 120 letras)." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("turmas").insert({ org_id: empresa.id, nome, modo });
  if (error) {
    return { ok: false, mensagem: error.code === "23505" ? `Já existe “${nome}”.` : mensagemDeErro(error, "Não foi possível criar. Tente de novo.") };
  }
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: `“${nome}” criada. Escolha no topo para usar.`, vez: Date.now() };
}

/** Renomeia, muda o modo ou arquiva uma turma. */
export async function salvarTurma(slug: string, id: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const nome = String(dados.get("nome") ?? "").trim();
  const modo: Modo = dados.get("modo") === "individual" ? "individual" : "grupos";
  const arquivada = dados.get("arquivada") === "on";
  if (!nome || nome.length > 120) return { ok: false, mensagem: "Escreva o nome (até 120 letras)." };
  const supabase = await criarClienteServidor();
  const { data: ativas } = await supabase.from("turmas").select("id").eq("org_id", empresa.id).eq("arquivada", false);
  if (arquivada && (ativas ?? []).every((t) => t.id === id)) return { ok: false, mensagem: "Precisa sobrar pelo menos uma ativa." };
  const { data, error } = await supabase.from("turmas").update({ nome, modo, arquivada }).eq("id", id).eq("org_id", empresa.id).select("id");
  if (error) {
    return { ok: false, mensagem: error.code === "23505" ? `Já existe “${nome}”.` : mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  }
  if (!data?.length) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: "Salvo.", vez: Date.now() };
}

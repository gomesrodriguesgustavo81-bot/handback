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

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("organizacoes")
    .update({ nome, vocabulario })
    .eq("id", empresa.id)
    .select("id");
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  if (!data?.length) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };

  revalidatePath("/app", "layout");
  return { ok: true, mensagem: "Ajustes salvos.", vez: Date.now() };
}

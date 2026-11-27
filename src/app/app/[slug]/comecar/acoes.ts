"use server";

import { revalidatePath } from "next/cache";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import { colunasDasEscolhas, ESCOLHAS_PADRAO, type EscolhasIA } from "@/lib/ia/escolhas";
import { montarVocabulario, USOS, type Modo } from "@/lib/nomes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";

export type RespostasPrimeiroAcesso = {
  uso: string;
  modo: Modo;
  espaco: string;
  grupo: string;
  pessoa: string;
  etapa: string;
  nomeTurma: string;
  /** Como a IA ajuda e a proteção dos dados dos alunos (escolhas de quem criou a conta). */
  ia?: EscolhasIA;
};

/** Guarda as respostas do primeiro acesso: nomes, modo e a primeira turma. */
export async function concluirPrimeiroAcesso(slug: string, r: RespostasPrimeiroAcesso): Promise<{ ok: boolean; mensagem: string }> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só o administrador configura a conta." };
  const uso = USOS.find((u) => u.id === r.uso);
  const palavras = { espaco: r.espaco, grupo: r.grupo, pessoa: r.pessoa, etapa: r.etapa, avaliador: uso?.avaliador ?? "Avaliador" };
  if (Object.values(palavras).some((x) => !x?.trim() || x.trim().length > 40)) return { ok: false, mensagem: "Escolha ou escreva todos os nomes (até 40 letras)." };
  const nomeTurma = r.nomeTurma.trim().slice(0, 120);
  if (!nomeTurma) return { ok: false, mensagem: "Dê um nome." };
  const modo: Modo = r.modo === "individual" ? "individual" : "grupos";

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("organizacoes")
    .update({ vocabulario: montarVocabulario(palavras), modo_padrao: modo, configurada: true, ...colunasDasEscolhas(r.ia ?? ESCOLHAS_PADRAO) })
    .eq("id", empresa.id);
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  const turma = await turmaAtual(empresa.id);
  if (turma) {
    const { error: e2 } = await supabase.from("turmas").update({ nome: nomeTurma, modo }).eq("id", turma.id);
    if (e2) return { ok: false, mensagem: e2.code === "23505" ? `Já existe “${nomeTurma}”.` : "Não foi possível salvar. Tente de novo." };
  }
  revalidatePath(`/app/${slug}`, "layout");
  revalidatePath("/app");
  return { ok: true, mensagem: "Pronto." };
}

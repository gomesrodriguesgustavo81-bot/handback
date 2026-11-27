import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { eDonoDaPlataforma, empresaPorSlug, type MinhaEmpresa } from "./sessao";

export type Contexto = {
  empresa: MinhaEmpresa;
  /** Pode cadastrar e alterar (administrador da empresa ou dono da plataforma). */
  podeGerir: boolean;
  /** Pode ver grupos e e-mails (avaliador, administrador ou dono). */
  podeAvaliar: boolean;
  /** Coordenador ou banca: vê só números e conceitos aprovados, nunca a correção. */
  ehCoordenacao: boolean;
};

/**
 * Carrega a empresa do endereço e o que a pessoa pode fazer nela, SEM mandar a coordenação
 * para outro lugar (usado pela moldura e pelas telas da própria coordenação).
 */
export const contextoCoordenacao = cache(async (slug: string): Promise<Contexto> => {
  const [empresa, dono] = await Promise.all([empresaPorSlug(slug), eDonoDaPlataforma()]);
  if (!empresa) notFound();
  const podeGerir = dono || empresa.papel === "admin";
  const podeAvaliar = podeGerir || empresa.papel === "avaliador";
  const ehCoordenacao = !dono && empresa.papel === "coordenador";
  return { empresa, podeGerir, podeAvaliar, ehCoordenacao };
});

/**
 * Carrega a empresa do endereço e o que a pessoa pode fazer nela.
 * Quem não faz parte recebe "página não encontrada" (e o banco também barra).
 * Coordenador e banca não entram nas telas de correção: vão para o aviso (o banco barra de qualquer jeito).
 */
export async function contextoDaEmpresa(slug: string): Promise<Contexto> {
  const c = await contextoCoordenacao(slug);
  if (c.ehCoordenacao) redirect(`/app/${slug}/coordenacao/sem-acesso`);
  return c;
}

/** Traduz erros do banco para mensagens simples. */
export function mensagemDeErro(erro: { code?: string; message?: string } | null, padrao: string): string {
  if (!erro) return padrao;
  if (erro.code === "42501") return "Você não tem permissão para fazer isso.";
  if (erro.code === "23514") return "Algum campo está fora do formato esperado. Confira e tente de novo.";
  if (erro.code === "P0001" && erro.message) return erro.message;
  return padrao;
}

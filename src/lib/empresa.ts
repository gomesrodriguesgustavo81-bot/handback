import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { PAPEIS } from "./frentes";
import { eDonoDaPlataforma, empresaPorSlug, type MinhaEmpresa } from "./sessao";

export type Contexto = {
  empresa: MinhaEmpresa;
  /** Pode cadastrar e alterar (administrador da empresa ou dono da plataforma). */
  podeGerir: boolean;
  /** Pode ver grupos e e-mails (avaliador, administrador ou dono). */
  podeAvaliar: boolean;
  /** Entrega por um grupo desta empresa (o e-mail está cadastrado nele). */
  souIntegrante: boolean;
  /** Como a pessoa aparece nesta empresa ("Administrador", "Equipe Azul"…). */
  descricaoDoPapel: string;
};

/**
 * Carrega a empresa do endereço e o que a pessoa pode fazer nela.
 * Quem não faz parte recebe "página não encontrada" (e o banco também barra).
 */
export const contextoDaEmpresa = cache(async (slug: string): Promise<Contexto> => {
  const [empresa, dono] = await Promise.all([empresaPorSlug(slug), eDonoDaPlataforma()]);
  if (!empresa) notFound();
  const podeGerir = dono || empresa.papel === "admin";
  const podeAvaliar = podeGerir || empresa.papel === "avaliador";
  const souIntegrante = empresa.meuGrupo !== null;
  const descricaoDoPapel = empresa.papel
    ? PAPEIS[empresa.papel]
    : dono
      ? "Dono da plataforma"
      : souIntegrante
        ? `Entrega por ${empresa.vocabulario.grupo.toLowerCase()} · ${empresa.meuGrupo!.nome}`
        : "Participante";
  return { empresa, podeGerir, podeAvaliar, souIntegrante, descricaoDoPapel };
});

/** Traduz erros do banco para mensagens simples. */
export function mensagemDeErro(erro: { code?: string; message?: string } | null, padrao: string): string {
  if (!erro) return padrao;
  if (erro.code === "42501") return "Você não tem permissão para fazer isso.";
  if (erro.code === "23514") return "Algum campo está fora do formato esperado. Confira e tente de novo.";
  if (erro.code === "P0001" && erro.message) return erro.message;
  return padrao;
}

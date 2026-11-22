import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { supabaseConfigurado } from "./supabase/config";
import { criarClienteServidor } from "./supabase/server";
import type { Frente, Papel, Vocabulario } from "./frentes";

/**
 * Leitura central de "quem está logado" e "o que essa pessoa pode ver".
 * Toda tela protegida passa por aqui. O banco ainda confere de novo
 * (Row Level Security), então um erro aqui nunca expõe dados de outra empresa.
 */

export const usuarioAtual = cache(async () => {
  await connection(); // sempre na hora do acesso, nunca pré-montada
  if (!supabaseConfigurado()) redirect("/entrar");
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  return { id: user.id, email: user.email ?? "" };
});

export const eDonoDaPlataforma = cache(async () => {
  await connection();
  if (!supabaseConfigurado()) return false;
  const supabase = await criarClienteServidor();
  const { data } = await supabase.rpc("e_admin_plataforma");
  return data === true;
});

export type MinhaEmpresa = {
  id: string;
  nome: string;
  slug: string;
  frente: Frente;
  ativa: boolean;
  papel: Papel | null;
  vocabulario: Vocabulario;
};

type LinhaEmpresa = Omit<MinhaEmpresa, "papel"> & { membros: { papel: Papel; user_id: string }[] };

/** Empresas que a pessoa vê (as dela; o dono da plataforma vê todas). */
export const minhasEmpresas = cache(async (): Promise<MinhaEmpresa[]> => {
  const eu = await usuarioAtual();
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("organizacoes")
    .select("id, nome, slug, frente, ativa, vocabulario, membros(papel, user_id)")
    .order("nome");
  if (error) throw new Error("Não foi possível carregar as empresas.");
  return (data as LinhaEmpresa[]).map(({ membros, ...org }) => ({
    ...org,
    papel: membros.find((m) => m.user_id === eu.id)?.papel ?? null,
  }));
});

export async function empresaPorSlug(slug: string) {
  const lista = await minhasEmpresas();
  return lista.find((e) => e.slug === slug) ?? null;
}

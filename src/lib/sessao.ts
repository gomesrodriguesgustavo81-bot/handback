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

/** Só confere o login (usado pelas telas de criar senha e cadastrar as 2 etapas). */
export const sessaoBasica = cache(async () => {
  await connection(); // sempre na hora do acesso, nunca pré-montada
  if (!supabaseConfigurado()) redirect("/entrar");
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: nivel } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return {
    id: user.id,
    email: user.email ?? "",
    senhaDefinida: user.app_metadata?.senha_definida === true,
    nome: String(user.user_metadata?.nome ?? "").trim(),
    nivel: nivel?.currentLevel ?? "aal1",
    temSegundaEtapa: nivel?.nextLevel === "aal2",
  };
});

/**
 * Quem está logado, já com a segurança completa: senha criada e, quando a
 * empresa exige (ou é o dono da plataforma), o código das duas etapas.
 * Toda tela protegida passa por aqui. O banco confere de novo.
 */
export const usuarioAtual = cache(async () => {
  const s = await sessaoBasica();
  if (!s.senhaDefinida) redirect("/definir-senha");
  if (s.temSegundaEtapa && s.nivel !== "aal2") redirect("/entrar/codigo");
  // Nos 14 primeiros dias (sem o app cadastrado), a senha basta: só aparece um lembrete.
  let prazoDuasEtapas: string | null = null;
  if (s.nivel !== "aal2") {
    const supabase = await criarClienteServidor();
    const [{ data: precisa }, { data: fim }] = await Promise.all([supabase.rpc("preciso_de_duas_etapas"), supabase.rpc("fim_da_experiencia")]);
    if (precisa && !fim) redirect("/conta/duas-etapas");
    if (precisa && fim) prazoDuasEtapas = String(fim);
  }
  return { id: s.id, email: s.email, nome: s.nome, duasEtapas: s.nivel === "aal2", prazoDuasEtapas };
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
  /** Já passou pelo primeiro acesso guiado. */
  configurada: boolean;
};

type LinhaEmpresa = Omit<MinhaEmpresa, "papel"> & { membros: { papel: Papel; user_id: string }[] };

/** Empresas que a pessoa vê (as dela; o dono da plataforma vê todas). */
export const minhasEmpresas = cache(async (): Promise<MinhaEmpresa[]> => {
  const eu = await usuarioAtual();
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("organizacoes")
    .select("id, nome, slug, frente, ativa, vocabulario, configurada, membros(papel, user_id)")
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

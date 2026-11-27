import "server-only";
import { notFound } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { montarLinhaDoTempo, type EntregaBase, type Ponto } from "@/lib/linha-do-tempo";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";
import { hojeISO } from "@/lib/textos";
import { etapasDaEmpresa } from "@/app/app/[slug]/entregas/dados";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

const COLUNAS = "id, grupo_id, etapa_id, enviada_em, atrasada, analises(status, conceito, checklist, alertas, devolutiva)";

/** Quem avalia vê a linha do tempo de um aluno/equipe da turma atual; qualquer outro caso é “não encontrado”. */
export async function carregarLinhaDoTempo(slug: string, grupoId: string) {
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar || !ehUuid(grupoId)) notFound();
  const supabase = await criarClienteServidor();
  const turma = await turmaAtual(empresa.id);
  if (!turma) notFound();
  const { data: grupo } = await supabase
    .from("grupos")
    .select("id, nome, tema")
    .eq("id", grupoId)
    .eq("org_id", empresa.id)
    .eq("turma_id", turma.id)
    .eq("ativo", true)
    .maybeSingle();
  if (!grupo) notFound();
  const [etapas, { data }] = await Promise.all([
    etapasDaEmpresa(empresa.id, turma.id),
    supabase.from("entregas").select(COLUNAS).eq("org_id", empresa.id).eq("grupo_id", grupo.id).eq("status", "recebida").limit(500),
  ]);
  const pontos: Ponto[] = montarLinhaDoTempo(etapas, (data ?? []) as unknown as EntregaBase[], hojeISO());
  return { empresa, turma, grupo: grupo as { id: string; nome: string; tema: string | null }, pontos, base: `/app/${slug}/entregas/evolucao/${grupo.id}` };
}

/** Todas as entregas valendo de uma etapa da turma (só dos alunos/equipes ativos), para comparar em números. */
export async function entregasDaEtapa(orgId: string, turmaId: string, etapaId: string): Promise<EntregaBase[]> {
  const supabase = await criarClienteServidor();
  const [{ data: grupos }, { data }] = await Promise.all([
    supabase.from("grupos").select("id").eq("org_id", orgId).eq("turma_id", turmaId).eq("ativo", true).limit(5000),
    supabase.from("entregas").select(COLUNAS).eq("org_id", orgId).eq("etapa_id", etapaId).eq("status", "recebida").limit(5000),
  ]);
  const ativos = new Set((grupos ?? []).map((g) => g.id));
  return ((data ?? []) as unknown as EntregaBase[]).filter((e) => ativos.has(e.grupo_id));
}

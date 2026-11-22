import "server-only";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataBR, hojeISO } from "@/lib/textos";
import type { Vocabulario } from "@/lib/frentes";
import type { OpcaoEtapa } from "@/components/form-entrega";

export type EtapaResumo = {
  id: string;
  numero: number;
  titulo: string;
  recebe_de: string | null;
  recebe_ate: string | null;
};

/** Todas as etapas da empresa, em ordem. */
export async function etapasDaEmpresa(orgId: string): Promise<EtapaResumo[]> {
  const supabase = await criarClienteServidor();
  const { data } = await supabase
    .from("etapas")
    .select("id, numero, titulo, recebe_de, recebe_ate")
    .eq("org_id", orgId)
    .order("numero");
  return data ?? [];
}

/** Situação do prazo de uma etapa, em palavras. */
export function situacaoDoPrazo(e: EtapaResumo): string {
  const hoje = hojeISO();
  if (!e.recebe_ate) return "sem prazo";
  if (e.recebe_de && hoje < e.recebe_de) return `abre em ${dataBR(e.recebe_de)}`;
  if (hoje > e.recebe_ate) return `prazo encerrado em ${dataBR(e.recebe_ate)}`;
  return `até ${dataBR(e.recebe_ate)}`;
}

export function opcoesDeEtapa(etapas: EtapaResumo[], v: Vocabulario): OpcaoEtapa[] {
  return etapas.map((e) => ({ id: e.id, rotulo: `${v.etapa} ${e.numero} · ${e.titulo}`, detalhe: situacaoDoPrazo(e) }));
}

/** Etapa que mais interessa agora: a de prazo mais próximo que ainda não venceu; senão, a última. */
export function etapaDaVez(etapas: EtapaResumo[]): EtapaResumo | undefined {
  const hoje = hojeISO();
  const abertas = etapas
    .filter((e) => e.recebe_ate && e.recebe_ate >= hoje && (!e.recebe_de || e.recebe_de <= hoje))
    .sort((a, b) => (a.recebe_ate! < b.recebe_ate! ? -1 : 1));
  return abertas[0] ?? etapas.at(-1);
}

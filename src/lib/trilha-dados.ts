import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeISO } from "./textos";
import { calcularTrilha, contarEntregas, type Contagem, type EntregaDaTrilha, type Trilha } from "./trilha";

export type EtapaDaTrilha = { id: string; entregaveis: string[] | null; recebe_ate: string | null; classroom_tarefa: string | null };
export type DadosDaTrilha = {
  contagem: Contagem;
  trilha: Trilha;
  /** Entregas que ainda precisam de análise (para o botão "Analisar"). */
  semAnalise: { id: string; nome: string }[];
  /** Aprovadas que ainda não saíram (para a tela Enviar). */
  paraEnviar: { id: string; nome: string }[];
};

/** A trilha de cada ciclo de uma turma, com poucas buscas no banco. */
export async function trilhasDaTurma(
  supabase: SupabaseClient,
  orgId: string,
  turma: { id: string; classroom_curso: string | null },
  etapas: EtapaDaTrilha[],
): Promise<Map<string, DadosDaTrilha>> {
  const ids = etapas.map((e) => e.id);
  const resultado = new Map<string, DadosDaTrilha>();
  if (!ids.length) return resultado;
  const [{ data: grupos }, { data: entregas }, { data: pendentes }] = await Promise.all([
    supabase.from("grupos").select("id, nome").eq("org_id", orgId).eq("turma_id", turma.id).eq("ativo", true).limit(5000),
    supabase
      .from("entregas")
      .select("id, etapa_id, grupo_id, analises(status, iniciada_em, enviada_em, moodle_enviada_em, classroom_enviada_em)")
      .in("etapa_id", ids)
      .eq("status", "recebida")
      .limit(20000),
    supabase.from("classroom_pendentes").select("etapa_id").in("etapa_id", ids).limit(20000),
  ]);
  const lista = (entregas ?? []) as unknown as EntregaDaTrilha[];
  const { data: fila } = lista.length
    ? await supabase.from("fila_analises").select("entrega_id").in("entrega_id", lista.map((e) => e.id)).is("feita_em", null)
    : { data: [] as { entrega_id: string }[] };
  const naFila = new Set((fila ?? []).map((f) => String(f.entrega_id)));
  const nomeDe = new Map((grupos ?? []).map((g) => [String(g.id), String(g.nome)]));
  const hoje = hojeISO();

  for (const etapa of etapas) {
    const doCiclo = lista.filter((e) => e.etapa_id === etapa.id && nomeDe.has(e.grupo_id));
    const contas = contarEntregas(doCiclo, naFila);
    const contagem: Contagem = {
      ...contas,
      checklist: (etapa.entregaveis ?? []).length,
      faltaTarefaClassroom: Boolean(turma.classroom_curso) && !etapa.classroom_tarefa,
      total: nomeDe.size,
      esperando: (pendentes ?? []).filter((p) => p.etapa_id === etapa.id).length,
      prazoPassou: Boolean(etapa.recebe_ate && hoje > etapa.recebe_ate),
    };
    const analise = (e: EntregaDaTrilha) => (Array.isArray(e.analises) ? e.analises[0] : e.analises);
    const nome = (e: EntregaDaTrilha) => ({ id: e.id, nome: nomeDe.get(e.grupo_id) ?? "" });
    resultado.set(etapa.id, {
      contagem,
      trilha: calcularTrilha(contagem),
      semAnalise: doCiclo
        .filter((e) => {
          if (naFila.has(e.id)) return false;
          const a = analise(e);
          return !a || (a.status !== "pronta" && a.status !== "aprovada" && !(a.status === "analisando" && a.iniciada_em && Date.now() - new Date(a.iniciada_em).getTime() < 5 * 60_000));
        })
        .map(nome),
      paraEnviar: doCiclo
        .filter((e) => {
          const a = analise(e);
          return a?.status === "aprovada" && !a.enviada_em && !a.moodle_enviada_em && !a.classroom_enviada_em;
        })
        .map(nome),
    });
  }
  return resultado;
}

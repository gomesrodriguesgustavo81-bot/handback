import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { completarVocabulario } from "./nomes";
import type { Vocabulario } from "./frentes";
import { hojeISO } from "./textos";

import type { DadosDaMensagem } from "@/components/endereco-turma";

const prazoEmPalavras = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "numeric", timeZone: "UTC" });

/** O que entra na mensagem para a turma: a aula da vez, prazos, o que entregar e quem assina. */
export async function dadosDaMensagem(
  supabase: SupabaseClient,
  org: { id: string; vocabulario: Vocabulario },
  turma: { id: string; modo: "grupos" | "individual" },
): Promise<DadosDaMensagem> {
  const vc = completarVocabulario(org.vocabulario);
  const [{ data: cfg }, { data: etapas }, { data: eu }] = await Promise.all([
    supabase.from("organizacoes").select("etiqueta_assunto").eq("id", org.id).maybeSingle(),
    supabase.from("etapas").select("id, numero, titulo, recebe_de, recebe_ate, entregaveis").eq("turma_id", turma.id).order("numero"),
    supabase.auth.getUser(),
  ]);
  const hoje = hojeISO();
  const lista = etapas ?? [];
  const abertas = lista.filter((e) => e.recebe_ate && e.recebe_ate >= hoje).sort((a, b) => (a.recebe_ate! < b.recebe_ate! ? -1 : 1));
  const nome = String((eu.user?.user_metadata as { nome?: string } | undefined)?.nome ?? "").trim();
  return {
    etiqueta: `[${cfg?.etiqueta_assunto ?? "ENTREGA"}]`,
    palavraEtapa: vc.etapa,
    quem: turma.modo === "individual" ? "seu nome" : `nome d${vc.generos.grupo === "f" ? "a" : "o"} ${vc.grupo.toLowerCase()}`,
    assinatura: nome,
    aulas: lista.map((e) => ({
      id: e.id,
      rotulo: `${vc.etapa} ${e.numero} · ${e.titulo}`,
      numero: e.numero,
      prazo: e.recebe_ate ? prazoEmPalavras(e.recebe_ate) : null,
      itens: (e.entregaveis as string[]) ?? [],
    })),
    daVez: abertas[0]?.id ?? null,
  };
}

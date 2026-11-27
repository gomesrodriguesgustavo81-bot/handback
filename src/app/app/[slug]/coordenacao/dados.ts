import "server-only";
import { notFound } from "next/navigation";
import { contextoCoordenacao } from "@/lib/empresa";
import { resumirCoordenacao, type LinhaCoord } from "@/lib/coordenacao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/textos";

/** Carrega o que a coordenação pode ver. Quem não é da coordenação nem avalia (ex.: participante) não entra. */
export async function carregarCoordenacao(slug: string) {
  const { empresa, ehCoordenacao, podeAvaliar } = await contextoCoordenacao(slug);
  if (!ehCoordenacao && !podeAvaliar) notFound();
  const supabase = await criarClienteServidor();
  const [{ data }, { data: meu }] = await Promise.all([
    supabase.rpc("dados_coordenacao", { p_org: empresa.id }),
    ehCoordenacao ? supabase.from("coordenacao").select("tipo, mostrar_nomes").eq("org_id", empresa.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    empresa,
    ehCoordenacao,
    tipo: (meu?.tipo as "coordenador" | "banca" | undefined) ?? null,
    resumo: resumirCoordenacao((data ?? []) as LinhaCoord[], hojeISO()),
  };
}

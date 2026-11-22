import type { Metadata } from "next";
import { TelaSimples } from "@/components/tela-simples";
import { caminhoSeguro } from "@/lib/caminhos";
import { lerConfigSupabase } from "@/lib/supabase/config";
import { Continuar } from "./continuar";

export const metadata: Metadata = { title: "Entrando…" };

/** Termina o login vindo de um link no formato padrão do Supabase (sessão depois do "#"). */
export default async function PaginaContinuar({ searchParams }: PageProps<"/auth/continuar">) {
  const { voltar } = await searchParams;
  const config = lerConfigSupabase();
  return (
    <TelaSimples titulo="Entrando…">
      {config ? <Continuar config={config} voltar={caminhoSeguro(voltar)} /> : <p>O banco de dados ainda não foi ligado.</p>}
    </TelaSimples>
  );
}

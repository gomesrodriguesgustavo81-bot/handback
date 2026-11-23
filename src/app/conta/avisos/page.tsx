import type { Metadata } from "next";
import Link from "next/link";
import { TopoApp } from "@/components/topo-app";
import { PAPEIS } from "@/lib/frentes";
import { completarVocabulario } from "@/lib/nomes";
import { eDonoDaPlataforma, minhasEmpresas, usuarioAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { EscolhasAvisos } from "./escolhas";

export const metadata: Metadata = { title: "Meus avisos" };

export default async function MeusAvisos() {
  const [eu, dono] = await Promise.all([usuarioAtual(), eDonoDaPlataforma()]);
  const supabase = await criarClienteServidor();
  const [{ data: p }, { data: gmail }] = await Promise.all([
    supabase.from("preferencias_avisos").select("resumo_email, celular, tipos").maybeSingle(),
    supabase.from("contas_gmail").select("invalida").maybeSingle(),
  ]);
  const prefs = { resumo_email: p?.resumo_email ?? true, celular: p?.celular ?? false, tipos: (p?.tipos as string[]) ?? ["entrega", "ia", "prazo", "atraso"] };
  return (
    <>
      <TopoApp email={eu.email} dono={dono} empresas={(await minhasEmpresas()).map((e) => ({ slug: e.slug, nome: e.nome, papel: e.papel ? PAPEIS[e.papel] : "Dono do Handback", palavra: completarVocabulario(e.vocabulario).organizacao, avalia: !e.papel || e.papel === "admin" || e.papel === "avaliador" }))} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
        <div>
          <Link href="/conta" className="text-sm text-suave hover:text-texto">
            ← Minha conta
          </Link>
          <h1 className="text-2xl font-bold">Meus avisos</h1>
          <p className="text-sm text-suave">Vale para você, em todas as turmas. Cada pessoa escolhe os seus.</p>
        </div>
        <EscolhasAvisos prefs={prefs} temGmail={Boolean(gmail && !gmail.invalida)} />
      </main>
    </>
  );
}

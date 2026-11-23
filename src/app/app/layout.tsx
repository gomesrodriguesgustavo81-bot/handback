import { completarVocabulario } from "@/lib/nomes";
import { PAPEIS } from "@/lib/frentes";
import { TopoApp } from "@/components/topo-app";
import { SemConfiguracao } from "@/components/sem-configuracao";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { eDonoDaPlataforma, usuarioAtual, minhasEmpresas } from "@/lib/sessao";

export default async function LayoutApp({ children }: LayoutProps<"/app">) {
  if (!supabaseConfigurado()) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <SemConfiguracao />
      </main>
    );
  }
  const [eu, dono] = await Promise.all([usuarioAtual(), eDonoDaPlataforma()]);
  return (
    <>
      <TopoApp email={eu.email} dono={dono} empresas={(await minhasEmpresas()).map((e) => ({ slug: e.slug, nome: e.nome, papel: e.papel ? PAPEIS[e.papel] : "Dono do Handback", palavra: completarVocabulario(e.vocabulario).organizacao, avalia: !e.papel || e.papel === "admin" || e.papel === "avaliador" }))} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">{children}</main>
    </>
  );
}

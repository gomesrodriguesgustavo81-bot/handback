import { criarClienteServidor } from "@/lib/supabase/server";
import Link from "next/link";
import { completarVocabulario } from "@/lib/nomes";
import { PAPEIS } from "@/lib/frentes";
import { TopoApp } from "@/components/topo-app";
import { SemConfiguracao } from "@/components/sem-configuracao";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { eDonoDaPlataforma, usuarioAtual, minhasEmpresas } from "@/lib/sessao";
import { after } from "next/server";
import { meusAvisos } from "@/lib/avisos";
import { despacharPush } from "@/lib/push";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { hojeISO } from "@/lib/textos";
import { origemDoSite } from "@/lib/acesso";
import { chamarFila, filaParada } from "@/lib/fila";
import { levarParaODrivePor } from "@/lib/drive";
import { LembreteDuasEtapas } from "@/components/lembrete-duas-etapas";

export default async function LayoutApp({ children }: LayoutProps<"/app">) {
  if (!supabaseConfigurado()) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <SemConfiguracao />
      </main>
    );
  }
  const [eu, dono, avisos] = await Promise.all([usuarioAtual(), eDonoDaPlataforma(), meusAvisos()]);
  // Manda para os celulares os avisos que surgiram (entregas, análises…).
  // E acorda a fila de análises se ela parou (ex.: a IA pediu uma pausa).
  const origem = await origemDoSite();
  // Duas etapas ativas e nenhum código de recuperação guardado: lembra de gerar (se perder o celular, ficaria sem acesso).
  let semCodigos = false;
  if (eu.duasEtapas) {
    const { data: restantes } = await (await criarClienteServidor()).rpc("meus_codigos_de_recuperacao");
    semCodigos = Number(restantes ?? 0) === 0;
  }
  after(async () => {
    const admin = criarClienteAdmin();
    await despacharPush(admin).catch(() => 0);
    if (admin && (await filaParada(admin).catch(() => false))) await chamarFila(origem);
    // Arquivos esperando para ir ao Google Drive (das turmas que ligaram o Drive).
    if (admin) await levarParaODrivePor(admin, 20_000).catch(() => undefined);
  });
  return (
    <>
      <TopoApp email={eu.email} nome={eu.nome} dono={dono} avisos={{ ...avisos, hoje: hojeISO() }} empresas={(await minhasEmpresas()).map((e) => ({ slug: e.slug, nome: e.nome, papel: e.papel ? PAPEIS[e.papel] : "Dono do Handback", palavra: completarVocabulario(e.vocabulario).organizacao, avalia: !e.papel || e.papel === "admin" || e.papel === "avaliador" }))} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        {semCodigos ? (
          <section role="status" aria-label="Códigos de recuperação" className="flex flex-col gap-1 rounded-2xl bg-alerta-fundo px-4 py-3 text-sm text-alerta">
            <strong className="text-[15px]">Guarde seus códigos de recuperação</strong>
            <span>Se perder o celular, eles são a forma de voltar a entrar.</span>
            <Link href="/conta#codigos" className="self-start font-semibold underline">
              Gerar agora
            </Link>
          </section>
        ) : null}
        {eu.prazoDuasEtapas ? <LembreteDuasEtapas prazo={eu.prazoDuasEtapas} /> : null}
        {children}
      </main>
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { PreferenciasDeEnvio } from "./preferencias";
import { ContaNecessaria } from "@/components/conta-necessaria";

export const metadata: Metadata = { title: "Devolutiva por e-mail" };

/** O Gmail de quem está logado: de onde saem as devolutivas. Cada pessoa conecta o seu. */
export default async function Email({ params }: PageProps<"/app/[slug]/configuracoes/email">) {
  const { slug } = await params;
  const { podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) notFound();
  const supabase = await criarClienteServidor();
  const [{ data: conta }, { data: eu }] = await Promise.all([supabase.from("contas_gmail").select("email, conectada_em, invalida").maybeSingle(), supabase.auth.getUser()]);
  const meta = (eu.user?.user_metadata ?? {}) as { nome?: string; copia_devolutiva?: boolean };
  const ligado = conta && !conta.invalida;

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Devolutiva por e-mail</h1>
        <p className="text-sm text-suave">Como as devolutivas que você aprova saem do seu Gmail. Vale só para você.</p>
      </div>
      <ContaNecessaria slug={slug} nome="Gmail" conta={ligado ? conta.email : conta?.invalida ? "expirou" : null} />
      <PreferenciasDeEnvio nome={String(meta.nome ?? "")} copia={meta.copia_devolutiva !== false} email={eu.user?.email ?? ""} />
      <section className="flex flex-col gap-1 rounded-2xl border border-borda bg-cartao p-4">
        <h2 className="font-semibold">Sem Gmail?</h2>
        <p className="text-sm text-suave">Dá para copiar a devolutiva pronta e enviar pelo seu e-mail de sempre.</p>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AvisoGmail } from "@/components/aviso-gmail";
import { ConectarGmail } from "@/components/conectar-gmail";
import { BotaoConfirmar } from "@/components/form-acao";
import { contextoDaEmpresa } from "@/lib/empresa";
import { gmailConfigurado } from "@/lib/gmail";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { desconectarGmail } from "../../entregas/acoes";
import { PreferenciasDeEnvio } from "./preferencias";

export const metadata: Metadata = { title: "E-mail" };

/** O Gmail de quem está logado: de onde saem as devolutivas. Cada pessoa conecta o seu. */
export default async function Email({ params, searchParams }: PageProps<"/app/[slug]/configuracoes/email">) {
  const { slug } = await params;
  const { gmail: aviso } = await searchParams;
  const { podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) notFound();
  const supabase = await criarClienteServidor();
  const [{ data: conta }, { data: eu }] = await Promise.all([supabase.from("contas_gmail").select("email, conectada_em, invalida").maybeSingle(), supabase.auth.getUser()]);
  const meta = (eu.user?.user_metadata ?? {}) as { nome?: string; copia_devolutiva?: boolean };
  const ligado = conta && !conta.invalida;
  const voltar = `/app/${slug}/configuracoes/email`;

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">E-mail</h1>
        <p className="text-sm text-suave">De onde saem as devolutivas que você aprova. Vale só para você: cada pessoa conecta o próprio Gmail.</p>
      </div>
      <AvisoGmail aviso={aviso} />
      {!gmailConfigurado() ? (
        <p className="rounded-2xl border border-borda bg-cartao p-4 text-sm text-suave">O envio pelo Gmail ainda não foi configurado no servidor.</p>
      ) : ligado ? (
        <section aria-label="Gmail conectado" className="entra flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-acento text-sobre-acento">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="font-semibold">Gmail conectado</p>
              <p className="break-all text-sm text-suave">{conta.email}</p>
            </div>
          </div>
          <p className="text-sm text-suave">
            As devolutivas saem deste endereço, como se você tivesse escrito. O Handback só envia; não lê sua caixa. Conectado em {dataHoraBR(conta.conectada_em)}.
          </p>
          <BotaoConfirmar
            acao={desconectarGmail.bind(null, slug)}
            pergunta="Desconectar? As devolutivas param de sair do seu Gmail até você conectar de novo. Nada é apagado."
          >
            Desconectar Gmail
          </BotaoConfirmar>
        </section>
      ) : (
        <section aria-label="Conectar o Gmail" className="entra flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
          <h2 className="font-[family-name:var(--fonte-titulo)] text-xl font-extrabold">Envie pelo seu Gmail</h2>
          <p className="text-sm text-suave">
            {conta?.invalida ? "A conexão com o seu Gmail expirou. " : ""}Os alunos recebem a devolutiva do seu endereço. O Handback só envia; não lê sua
            caixa.
          </p>
          <ConectarGmail voltar={voltar} />
          <p className="text-xs text-suave">Abre uma janelinha do Google. Depois de aceitar, ela fecha sozinha e você continua aqui.</p>
        </section>
      )}
      <PreferenciasDeEnvio nome={String(meta.nome ?? "")} copia={meta.copia_devolutiva !== false} email={eu.user?.email ?? ""} />
      <section className="flex flex-col gap-1 rounded-2xl border border-borda bg-cartao p-4">
        <h2 className="font-semibold">Sem Gmail?</h2>
        <p className="text-sm text-suave">Dá para copiar a devolutiva pronta e enviar pelo seu e-mail de sempre.</p>
      </section>
    </div>
  );
}

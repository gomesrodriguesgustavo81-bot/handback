import type { Metadata } from "next";
import { TopoApp } from "@/components/topo-app";
import { Cartao, LinkBotao } from "@/components/ui";
import { eDonoDaPlataforma, usuarioAtual } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { sairDeTodos } from "./acoes";
import { CadastroDuasEtapas } from "./formularios";

export const metadata: Metadata = { title: "Minha conta" };

export default async function MinhaConta() {
  const [eu, dono] = await Promise.all([usuarioAtual(), eDonoDaPlataforma()]);
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.mfa.listFactors();
  const temApp = (data?.totp ?? []).some((f) => f.status === "verified");
  return (
    <>
      <TopoApp email={eu.email} dono={dono} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold">Minha conta</h1>
          <p className="break-words text-sm text-suave">{eu.email}</p>
        </div>
        <Cartao className="flex flex-col gap-3">
          <h2 className="font-semibold">Senha</h2>
          <p className="text-sm text-suave">Troque se desconfiar que alguém sabe a sua senha.</p>
          <LinkBotao href="/definir-senha" variante="secundario" className="self-start">
            Trocar a senha
          </LinkBotao>
        </Cartao>
        <Cartao className="flex flex-col gap-3">
          <h2 className="font-semibold">Verificação em duas etapas</h2>
          {temApp ? (
            <>
              <p className="text-sm text-marca-forte">Ativada: o Handback pede o código do seu celular para entrar.</p>
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-marca-forte">Trocar de celular</summary>
                <div className="mt-3">
                  <CadastroDuasEtapas textoBotao="Cadastrar o celular novo" />
                </div>
              </details>
            </>
          ) : (
            <>
              <p className="text-sm text-suave">Desativada. Ative para proteger os documentos da sua empresa.</p>
              <CadastroDuasEtapas textoBotao="Ativar agora" />
            </>
          )}
        </Cartao>
        <Cartao className="flex flex-col gap-3">
          <h2 className="font-semibold">Aparelhos conectados</h2>
          <p className="text-sm text-suave">Perdeu o celular ou entrou num computador que não é seu? Saia de todos os aparelhos de uma vez.</p>
          <form action={sairDeTodos}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-xl border border-erro/40 px-4 text-sm font-medium text-erro hover:bg-erro-fundo"
            >
              Sair de todos os aparelhos
            </button>
          </form>
        </Cartao>
      </main>
    </>
  );
}

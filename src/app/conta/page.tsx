import { completarVocabulario } from "@/lib/nomes";
import { PAPEIS } from "@/lib/frentes";
import type { Metadata } from "next";
import { TopoApp } from "@/components/topo-app";
import { FormConfirmado } from "@/components/confirmar";
import { Cartao, LinkBotao } from "@/components/ui";
import { eDonoDaPlataforma, usuarioAtual, minhasEmpresas } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { sairDeTodos } from "./acoes";
import { CadastroDuasEtapas } from "./formularios";
import { EscolhaTema } from "@/components/escolha-tema";
import { CodigosDeRecuperacao } from "@/components/codigos-recuperacao";

export const metadata: Metadata = { title: "Minha conta" };

/** "Chrome em Windows", "Safari em iPhone"… a partir do texto que o navegador manda. */
function resumoDoAparelho(ua: string): string {
  const sistema = /Windows/i.test(ua) ? "Windows" : /iPhone|iPad/i.test(ua) ? "iPhone/iPad" : /Android/i.test(ua) ? "Android" : /Mac OS/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "";
  const navegador = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return [navegador, sistema].filter(Boolean).join(" em ") || ua.slice(0, 60);
}

export default async function MinhaConta() {
  const [eu, dono] = await Promise.all([usuarioAtual(), eDonoDaPlataforma()]);
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.mfa.listFactors();
  const temApp = (data?.totp ?? []).some((f) => f.status === "verified");
  const [{ data: restantes }, { data: sessoes }] = await Promise.all([
    supabase.rpc("meus_codigos_de_recuperacao"),
    supabase.rpc("minhas_sessoes"),
  ]);
  const { data: acessos } = await supabase
    .from("atividades")
    .select("id, descricao, ip, aparelho, criado_em")
    .is("org_id", null)
    .eq("user_id", eu.id)
    .order("id", { ascending: false })
    .limit(10);
  return (
    <>
      <TopoApp email={eu.email} dono={dono} empresas={(await minhasEmpresas()).map((e) => ({ slug: e.slug, nome: e.nome, papel: e.papel ? PAPEIS[e.papel] : "Dono do Handback", palavra: completarVocabulario(e.vocabulario).organizacao, avalia: !e.papel || e.papel === "admin" || e.papel === "avaliador" }))} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold">Minha conta</h1>
          <p className="break-words text-sm text-suave">{eu.email}</p>
        </div>
        <Cartao id="aparencia" className="flex scroll-mt-20 flex-col gap-3">
          <h2 className="font-semibold">Aparência</h2>
          <p className="text-sm text-suave">Vale só para você, neste aparelho.</p>
          <EscolhaTema />
        </Cartao>
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
              <div id="codigos" className="scroll-mt-20 border-t border-borda pt-3">
                <h3 className="mb-2 text-sm font-semibold">Códigos de recuperação</h3>
                <CodigosDeRecuperacao restantes={Number(restantes ?? 0)} />
              </div>
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
          <h2 className="font-semibold">Seus últimos acessos</h2>
          <p className="text-sm text-suave">Não reconhece algum? Troque a senha e saia de todos os aparelhos.</p>
          {acessos?.length ? (
            <ol className="flex flex-col divide-y divide-borda text-sm">
              {acessos.map((x) => (
                <li key={x.id} className="flex flex-col py-2">
                  <span>{x.descricao}</span>
                  <span className="break-all text-xs text-suave">
                    {dataHoraBR(x.criado_em)}
                    {x.aparelho ? ` · ${x.aparelho}` : ""}
                    {x.ip ? ` · IP ${x.ip}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-suave">Nenhum acesso registrado ainda.</p>
          )}
        </Cartao>
        <Cartao className="flex flex-col gap-3">
          <h2 className="font-semibold">Aparelhos conectados</h2>
          <p className="text-sm text-suave">Perdeu o celular ou entrou num computador que não é seu? Saia de todos os aparelhos de uma vez.</p>
          {(sessoes as { id: string; atividade_em: string; aparelho: string; rede: string; esta: boolean }[] | null)?.length ? (
            <ul aria-label="Aparelhos conectados" className="flex flex-col divide-y divide-borda text-sm">
              {(sessoes as { id: string; atividade_em: string; aparelho: string; rede: string; esta: boolean }[]).map((x) => (
                <li key={x.id} className="flex flex-col py-2">
                  <span className="break-words font-medium">
                    {x.aparelho ? resumoDoAparelho(x.aparelho) : "Aparelho desconhecido"}
                    {x.esta ? <span className="ml-2 rounded-full bg-marca-clara px-2 py-0.5 text-xs font-bold text-marca-forte">este aparelho</span> : null}
                  </span>
                  <span className="text-xs text-suave">
                    Última atividade {dataHoraBR(x.atividade_em)}
                    {x.rede ? ` · rede ${x.rede}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <FormConfirmado action={sairDeTodos} pergunta={{ titulo: "Sair de todos os aparelhos?", texto: "Você vai precisar entrar de novo em cada um, inclusive neste.", sim: "Sim, sair de todos", perigo: true }}>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-xl border border-erro/40 px-4 text-sm font-medium text-erro hover:bg-erro-fundo"
            >
              Sair de todos os aparelhos
            </button>
          </FormConfirmado>
        </Cartao>
      </main>
    </>
  );
}

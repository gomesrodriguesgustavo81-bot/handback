import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, Selo } from "@/components/ui";
import { FRENTES, type Frente } from "@/lib/frentes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataBR, dataHoraBR, passouMaisDe } from "@/lib/textos";
import { assumirEspaco, mudarStatus } from "./actions";
import { FormEmergencia, FormSituacao } from "./formularios";
import { NovaEmpresa } from "./nova-empresa";

export const metadata: Metadata = { title: "Administração do Handback" };

type Espaco = {
  id: string;
  nome: string;
  slug: string;
  frente: Frente;
  ativa: boolean;
  situacao: string;
  teste_ate: string | null;
  criada_em: string;
  criada_por_cadastro: boolean;
  administradores: string[];
  pessoas: number;
  turmas: number;
  entregas: number;
  analises_30_dias: number;
  ultima_atividade: string | null;
  acesso_tipo: "suporte" | "emergencia" | null;
  acesso_ate: string | null;
};

/** Lista de espaços e números de uso. O conteúdo de cada espaço só abre com acesso de suporte (ou de emergência). */
export default async function PainelDono() {
  const supabase = await criarClienteServidor();
  const [{ data }, { data: gmail }] = await Promise.all([
    supabase.rpc("espacos_da_plataforma"),
    supabase.from("contas_gmail").select("email, invalida").maybeSingle(),
  ]);
  const espacos = (data ?? []) as Espaco[];

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Administração do Handback</h1>
        <p className="text-suave">Só você vê esta tela.</p>
      </div>

      <div className="flex gap-2.5 rounded-2xl bg-marca-forte p-4 text-sm text-white dark:bg-marca-clara dark:text-texto">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0 text-acento">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <p>
          Você vê a lista e os números de cada espaço, mas <strong>não o conteúdo</strong> (entregas, arquivos, devolutivas, pessoas). Para dar suporte, o
          cliente libera em Configurações › Segurança.
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 sm:max-w-xl">
        <div className="rounded-2xl border border-borda bg-cartao p-3 text-center">
          <dt className="text-xs text-suave">espaços</dt>
          <dd className="text-2xl font-bold">{espacos.length}</dd>
        </div>
        <div className="rounded-2xl border border-borda bg-cartao p-3 text-center">
          <dt className="text-xs text-suave">novos na semana</dt>
          <dd className="text-2xl font-bold">{espacos.filter((e) => !passouMaisDe(e.criada_em, 7 * 24 * 60)).length}</dd>
        </div>
        <div className="rounded-2xl bg-acento p-3 text-center text-sobre-acento">
          <dt className="text-xs">com suporte aberto</dt>
          <dd className="text-2xl font-bold">{espacos.filter((e) => e.acesso_tipo).length}</dd>
        </div>
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Espaços ({espacos.length})</h2>
          {!gmail || gmail.invalida ? (
            <p className="text-sm text-suave">
              Para usar o acesso de emergência, o cliente precisa ser avisado por e-mail:{" "}
              <a href="/api/gmail/conectar?voltar=/admin" className="font-medium text-marca-forte underline">
                Conectar meu Gmail
              </a>
            </p>
          ) : null}
          {espacos.length === 0 ? (
            <Cartao>
              <p className="text-suave">Nenhum espaço ainda.</p>
            </Cartao>
          ) : (
            <ul className="flex flex-col gap-3">
              {espacos.map((e) => (
                <li key={e.id} className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="titulo text-lg font-bold">{e.nome}</span>
                        {!e.ativa ? <Selo>Bloqueado</Selo> : null}
                        {e.acesso_tipo ? (
                          <span className="rounded-full bg-acento px-2.5 py-0.5 text-xs font-bold text-sobre-acento">
                            {e.acesso_tipo === "emergencia" ? "Emergência" : "Suporte"} até {dataHoraBR(e.acesso_ate)}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-suave [overflow-wrap:anywhere]">
                        {e.administradores.join(", ") || "sem administrador"} · {FRENTES[e.frente]?.curto} · /{e.slug}
                      </p>
                      <p className="text-xs text-suave">
                        Criado em {dataBR(e.criada_em)}
                        {e.criada_por_cadastro ? " pelo cadastro" : ""} · {e.pessoas} pessoa(s) · {e.turmas} turma(s) · {e.entregas} entrega(s) ·{" "}
                        {e.analises_30_dias} análise(s) de IA em 30 dias
                        {e.ultima_atividade ? ` · último uso ${dataHoraBR(e.ultima_atividade)}` : ""}
                      </p>
                    </div>
                    <form action={mudarStatus}>
                      <input type="hidden" name="id" value={e.id} />
                      <input type="hidden" name="ativa" value={String(!e.ativa)} />
                      <button type="submit" className="min-h-11 rounded-xl border border-borda px-3 text-sm hover:bg-fundo">
                        {e.ativa ? "Bloquear" : "Liberar"}
                      </button>
                    </form>
                  </div>
                  <FormSituacao id={e.id} situacao={e.situacao} testeAte={e.teste_ate} />
                  {e.acesso_tipo ? (
                    <Link href={`/app/${e.slug}`} className="inline-flex min-h-11 items-center justify-center self-start rounded-full bg-marca-forte px-4 font-medium text-white">
                      Entrar para dar suporte
                    </Link>
                  ) : e.pessoas === 0 ? (
                    <form action={assumirEspaco.bind(null, e.id, e.slug)} className="flex flex-wrap items-center gap-2">
                      <button type="submit" className="min-h-11 rounded-full bg-marca-forte px-4 font-medium text-white">
                        Assumir este espaço
                      </button>
                      <span className="text-xs text-suave">Ninguém dentro ainda: você vira administrador (fica registrado).</span>
                    </form>
                  ) : (
                    <FormEmergencia id={e.id} slug={e.slug} nome={e.nome} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <Cartao className="flex flex-col gap-4 self-start">
          <h2 className="font-semibold">Novo espaço</h2>
          <p className="-mt-2 text-sm text-suave">Normalmente os clientes se cadastram sozinhos. Use aqui para criar um à mão.</p>
          <NovaEmpresa />
        </Cartao>
      </div>
    </>
  );
}

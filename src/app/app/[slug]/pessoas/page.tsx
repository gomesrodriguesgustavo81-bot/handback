import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotaoConfirmar, FormAcao } from "@/components/form-acao";
import { Cartao, Campo, Escolha, Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { PAPEIS, type Papel } from "@/lib/frentes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/sessao";
import { cancelarConvite, convidar, mudarPapel, removerPessoa } from "./acoes";

export const metadata: Metadata = { title: "Pessoas" };

type Pessoa = { user_id: string; email: string; papel: Papel };

export default async function Pessoas({ params }: PageProps<"/app/[slug]/pessoas">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const v = empresa.vocabulario;
  const eu = await usuarioAtual();
  const supabase = await criarClienteServidor();
  const [{ data: pessoas }, { data: convites }] = await Promise.all([
    supabase.rpc("pessoas_da_org", { org: empresa.id }),
    supabase
      .from("convites")
      .select("id, email, papel, criado_em")
      .eq("org_id", empresa.id)
      .is("aceito_em", null)
      .order("criado_em", { ascending: false }),
  ]);

  const descricao: Record<Papel, string> = {
    admin: "Cadastra tudo, convida pessoas e muda os ajustes.",
    avaliador: `Vê ${v.etapas.toLowerCase()} e ${v.grupos.toLowerCase()}, revisa e aprova devolutivas.`,
    participante: `Vê as ${v.etapas.toLowerCase()} e o que deve ser entregue.`,
  };
  const opcoesPapel = (Object.keys(PAPEIS) as Papel[]).map((p) => ({
    valor: p,
    nome: p === "avaliador" ? `${PAPEIS[p]} (${v.avaliador.toLowerCase()})` : PAPEIS[p],
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Pessoas com acesso ({pessoas?.length ?? 0})</h2>
          <ul className="flex flex-col gap-3">
            {((pessoas ?? []) as Pessoa[]).map((p) => (
              <li key={p.user_id} className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="break-all font-medium">
                    {p.email}
                    {p.user_id === eu.id ? <span className="font-normal text-suave"> (você)</span> : null}
                  </span>
                  {p.user_id !== eu.id ? (
                    <BotaoConfirmar
                      acao={removerPessoa.bind(null, slug, p.user_id)}
                      pergunta={`Remover o acesso de ${p.email} a ${empresa.nome}?`}
                    >
                      Remover
                    </BotaoConfirmar>
                  ) : null}
                </div>
                <FormAcao acao={mudarPapel.bind(null, slug, p.user_id)} textoBotao="Salvar papel">
                  <Escolha rotulo="Papel" name="papel" defaultValue={p.papel} opcoes={opcoesPapel} dica={descricao[p.papel]} />
                </FormAcao>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Convites aguardando ({convites?.length ?? 0})</h2>
          {!convites?.length ? (
            <Vazio>Nenhum convite pendente.</Vazio>
          ) : (
            <ul className="flex flex-col gap-3">
              {convites.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-borda bg-cartao p-4">
                  <span className="min-w-0">
                    <span className="block break-all font-medium">{c.email}</span>
                    <span className="text-sm text-suave">{PAPEIS[c.papel as Papel]}</span>
                  </span>
                  <BotaoConfirmar acao={cancelarConvite.bind(null, slug, c.id)} pergunta={`Cancelar o convite de ${c.email}?`}>
                    Cancelar
                  </BotaoConfirmar>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Cartao className="flex flex-col gap-4 self-start">
        <h2 className="font-semibold">Convidar pessoa</h2>
        <FormAcao acao={convidar.bind(null, slug)} textoBotao="Convidar" limparAoSalvar>
          <Campo rotulo="E-mail" name="email" type="email" inputMode="email" required placeholder="pessoa@email.com" />
          <Escolha rotulo="Papel" name="papel" defaultValue="avaliador" opcoes={opcoesPapel} />
        </FormAcao>
        <ul className="flex flex-col gap-1 text-xs text-suave">
          {(Object.keys(PAPEIS) as Papel[]).map((p) => (
            <li key={p}>
              <strong>{PAPEIS[p]}:</strong> {descricao[p]}
            </li>
          ))}
        </ul>
      </Cartao>
    </div>
  );
}

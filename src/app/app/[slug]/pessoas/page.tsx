import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotaoConfirmar, FormAcao } from "@/components/form-acao";
import { Cartao, Campo, Escolha, Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { PAPEIS, type Papel } from "@/lib/frentes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/sessao";
import { turmasDaEmpresa } from "@/lib/turma";
import { cancelarConvite, convidar, mudarPapel, removerPessoa } from "./acoes";
import { ConvidarCoordenacao } from "./convidar-coordenacao";

export const metadata: Metadata = { title: "Quem usa o Handback" };

type Pessoa = { user_id: string; email: string; papel: Papel };

export default async function Pessoas({ params }: PageProps<"/app/[slug]/pessoas">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const v = empresa.vocabulario;
  const eu = await usuarioAtual();
  const supabase = await criarClienteServidor();
  const [{ data: pessoas }, { data: convites }, { data: coord }, turmas] = await Promise.all([
    supabase.rpc("pessoas_da_org", { org: empresa.id }),
    supabase
      .from("convites")
      .select("id, email, papel, criado_em, coord_tipo, coord_nomes, coord_turmas")
      .eq("org_id", empresa.id)
      .is("aceito_em", null)
      .order("criado_em", { ascending: false }),
    supabase.from("coordenacao").select("user_id, tipo, mostrar_nomes, coordenacao_turmas(turma_id)").eq("org_id", empresa.id),
    turmasDaEmpresa(empresa.id),
  ]);
  const ativas = turmas.filter((t) => !t.arquivada);
  const nomeDaTurma = new Map(turmas.map((t) => [t.id, t.nome]));
  type Escopo = { user_id: string; tipo: string; mostrar_nomes: boolean; coordenacao_turmas: { turma_id: string }[] };
  const escopoDe = new Map(((coord ?? []) as unknown as Escopo[]).map((c) => [c.user_id, c]));
  const textoDoEscopo = (tipo: string | null, nomes: boolean, ids: string[]) =>
    `${tipo === "banca" ? `Banca: ${ids.map((i) => nomeDaTurma.get(i) ?? "turma removida").join(", ")}` : "Coordenador: todas as turmas"} · ${nomes ? "vê os nomes" : "só números, sem nomes"}`;

  const descricao: Record<Papel, string> = {
    admin: "Cadastra tudo, convida pessoas e muda os ajustes.",
    avaliador: `Vê ${v.etapas.toLowerCase()} e ${v.grupos.toLowerCase()}, revisa e aprova devolutivas.`,
    participante: `Vê as ${v.etapas.toLowerCase()} e o que deve ser entregue.`,
    coordenador: "Vê só números e conceitos aprovados. Nunca a correção, os arquivos nem os e-mails.",
  };
  // Coordenador e banca têm convite próprio (com o escopo); aqui ficam os outros papéis.
  const opcoesPapel = (Object.keys(PAPEIS) as Papel[]).filter((p) => p !== "coordenador").map((p) => ({
    valor: p,
    nome: p === "avaliador" ? `${PAPEIS[p]} (${v.avaliador.toLowerCase()})` : PAPEIS[p],
  }));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_20rem]">
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
                {p.papel === "coordenador" ? (
                  <p className="text-sm text-suave">
                    <strong className="text-texto">Coordenação.</strong>{" "}
                    {escopoDe.get(p.user_id)
                      ? textoDoEscopo(escopoDe.get(p.user_id)!.tipo, escopoDe.get(p.user_id)!.mostrar_nomes, escopoDe.get(p.user_id)!.coordenacao_turmas.map((t) => t.turma_id))
                      : "Sem escopo: não vê nada. Remova e convide de novo."}
                  </p>
                ) : (
                <FormAcao acao={mudarPapel.bind(null, slug, p.user_id)} textoBotao="Salvar papel" confirmar={{ titulo: "Mudar o papel desta pessoa?", texto: "Muda o que ela pode ver e fazer aqui.", sim: "Sim, mudar" }}>
                  <Escolha rotulo="Papel" name="papel" defaultValue={p.papel} opcoes={opcoesPapel} dica={descricao[p.papel]} />
                </FormAcao>
                )}
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
                    <span className="text-sm text-suave">
                      {c.papel === "coordenador" ? textoDoEscopo(c.coord_tipo, c.coord_nomes, c.coord_turmas ?? []) : PAPEIS[c.papel as Papel]}
                    </span>
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
        <FormAcao acao={convidar.bind(null, slug)} textoBotao="Convidar" limparAoSalvar confirmar={{ titulo: "Convidar esta pessoa?", texto: "Ela recebe um e-mail para criar a senha e passa a ter acesso com o papel escolhido.", sim: "Sim, convidar" }}>
          <Campo rotulo="E-mail" name="email" type="email" inputMode="email" required placeholder="pessoa@email.com" />
          <Escolha rotulo="Papel" name="papel" defaultValue="avaliador" opcoes={opcoesPapel} />
        </FormAcao>
        <h3 className="border-t border-borda pt-4 font-semibold">Convidar coordenador ou banca</h3>
        <p className="-mt-2 text-xs text-suave">Para quem acompanha a escola ou o programa sem corrigir nada. Vê números e conceitos aprovados, nunca devolutivas, arquivos, análise da IA, e-mails nem contas.</p>
        <ConvidarCoordenacao slug={slug} turmas={ativas.map((t) => ({ id: t.id, nome: t.nome }))} />
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

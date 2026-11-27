import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotaoConfirmar, FormAcao } from "@/components/form-acao";
import { Cartao, Campo, Escolha, Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { PAPEIS, type Papel } from "@/lib/frentes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/sessao";
import { turmasDaEmpresa } from "@/lib/turma";
import { cancelarConvite, convidar, convidarCoordenacao, mudarPapel, removerPessoa } from "./acoes";

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
        <FormAcao
          acao={convidarCoordenacao.bind(null, slug)}
          textoBotao="Enviar convite"
          limparAoSalvar
          confirmar={(d) => ({
            titulo: "Enviar o convite?",
            texto: `${String(d.get("email") ?? "")} vai receber um e-mail e poderá ver números e conceitos aprovados${d.get("tipo") === "banca" ? " só das turmas escolhidas" : " de todas as turmas"}. Não verá devolutivas nem arquivos${d.get("nomes") === "on" ? ", mas verá os nomes" : " e não verá nomes"}.`,
            sim: "Sim, enviar",
          })}
        >
          <Campo rotulo="E-mail da pessoa" name="email" type="email" inputMode="email" required placeholder="coordenacao@escola.com" />
          <fieldset className="flex flex-col gap-2 rounded-xl border border-borda p-3">
            <legend className="px-1 text-sm font-medium">Papel</legend>
            <label className="flex min-h-11 items-start gap-2.5 text-sm">
              <input type="radio" name="tipo" value="coordenador" defaultChecked className="mt-1 size-4" />
              <span><b>Coordenador</b><br /><span className="text-xs text-suave">Todas as turmas.</span></span>
            </label>
            <label className="flex min-h-11 items-start gap-2.5 text-sm">
              <input type="radio" name="tipo" value="banca" className="mt-1 size-4" />
              <span><b>Banca</b><br /><span className="text-xs text-suave">Só as turmas marcadas abaixo.</span></span>
            </label>
          </fieldset>
          {ativas.length ? (
            <fieldset className="flex flex-col gap-1 rounded-xl border border-borda p-3">
              <legend className="px-1 text-sm font-medium">Turmas da banca</legend>
              {ativas.map((t) => (
                <label key={t.id} className="flex min-h-11 items-center gap-2.5 text-sm">
                  <input type="checkbox" name="turma" value={t.id} className="size-4" />
                  {t.nome}
                </label>
              ))}
            </fieldset>
          ) : null}
          <label className="flex min-h-11 items-start gap-2.5 text-sm">
            <input type="checkbox" name="nomes" className="mt-1 size-4" />
            <span><b>Mostrar nomes</b><br /><span className="text-xs text-suave">Desligado, só aparecem os números da turma. Ligado, aparecem as pessoas ou equipes com o conceito aprovado.</span></span>
          </label>
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

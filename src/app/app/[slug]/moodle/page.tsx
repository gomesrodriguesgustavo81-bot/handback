import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormAcao } from "@/components/form-acao";
import { Aviso, Cartao, LinkBotao } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { cursosDaPessoa, ErroMoodle, type Curso } from "@/lib/moodle/cliente";
import { conexaoPorId } from "@/lib/moodle/sincronizar";
import { completarVocabulario, o } from "@/lib/nomes";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { ligarDisciplina } from "./acoes";
import Link from "next/link";
import { FormConectarMoodle } from "./form-conectar";

export const metadata: Metadata = { title: "Nova turma do Moodle" };
export const maxDuration = 60;

function IconeMoodle() {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-alerta-fundo text-alerta">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 10L12 5 2 10l10 5 10-5z" />
        <path d="M6 12v5c3 2 9 2 12 0v-5" />
      </svg>
    </span>
  );
}

export default async function Moodle({ params, searchParams }: PageProps<"/app/[slug]/moodle">) {
  const { slug } = await params;
  const q = await searchParams;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const vc = completarVocabulario(empresa.vocabulario);
  const supabase = await criarClienteServidor();
  const [{ data: contas }, { data: turmas }] = await Promise.all([
    supabase.from("contas_moodle").select("id, site, site_nome, nome, invalida, erro, erro_em").eq("org_id", empresa.id).order("conectada_em", { ascending: false }),
    supabase.from("turmas").select("id, nome, moodle_conta, moodle_curso").eq("org_id", empresa.id).not("moodle_conta", "is", null),
  ]);
  const conta = (contas ?? []).find((c) => !c.invalida) ?? null;
  const cortada = !conta ? (contas ?? []).find((c) => c.invalida) : undefined;
  const expirada = cortada
    ? `A ligação com o Moodle foi cortada${cortada.erro_em ? ` em ${dataHoraBR(cortada.erro_em)}` : ""}${cortada.erro ? `. O Moodle disse: “${cortada.erro}”` : ""}. Entre de novo: as turmas que já vieram voltam a ficar ligadas.`
    : "";

  let cursos: Curso[] = [];
  let erroCursos = "";
  if (conta) {
    const admin = criarClienteAdmin();
    try {
      if (!admin) throw new ErroMoodle("O servidor ainda não está pronto.");
      const c = await conexaoPorId(admin, conta.id);
      cursos = (await cursosDaPessoa(c.site, c.chave, c.usuario)).filter((x) => x.visible !== 0);
    } catch (e) {
      erroCursos = e instanceof ErroMoodle ? e.message : "Não foi possível buscar as disciplinas no Moodle.";
    }
  }
  const ligadas = new Map((turmas ?? []).filter((t) => t.moodle_conta === conta?.id).map((t) => [Number(t.moodle_curso), t.nome as string]));
  const livres = cursos.filter((c) => !ligadas.has(c.id));
  const pronta = typeof q.pronta === "string" ? (turmas ?? []).find((t) => t.id === q.pronta) : undefined;
  const num = (k: string) => (typeof q[k] === "string" ? Number(q[k]) : 0);

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div className="flex items-center gap-3">
        <IconeMoodle />
        <div>
          <h1 className="text-2xl font-bold">
            Nov{o(vc, "espaco")} {vc.espaco.toLowerCase()} do Moodle
          </h1>
          <p className="text-sm text-suave">
            {conta ? "Passo 2 de 2 · disciplina" : "Passo 1 de 2 · entrar"} — alunos, grupos, tarefas e entregas vêm do Moodle.
          </p>
        </div>
      </div>

      {pronta ? (
        <Cartao className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            {vc.espaco} “{pronta.nome}” criada
          </h2>
          {typeof q.erro === "string" ? (
            <Aviso tipo="alerta">{q.erro}</Aviso>
          ) : (
            <p className="text-sm text-suave">
              Vieram do Moodle: {num("alunos")} alunos
              {num("grupos") && num("grupos") !== num("alunos") ? ` em ${num("grupos")} ${vc.grupos.toLowerCase()}` : ""}, {num("tarefas")} tarefas e{" "}
              {num("novas")} entregas. O Handback busca as entregas novas sempre que você abre a turma, e você também pode buscar na hora.
            </p>
          )}
          <p className="text-sm text-suave">
            Antes de pedir a análise da IA, confira em <strong>{vc.etapas}</strong> o que deve ser entregue em cada tarefa (o checklist).
          </p>
          <div className="flex flex-wrap gap-2">
            <LinkBotao href={`/app/${slug}/entregas`}>Ver as entregas</LinkBotao>
            <LinkBotao href={`/app/${slug}/etapas`} variante="secundario">
              Conferir {vc.etapas.toLowerCase()}
            </LinkBotao>
          </div>
        </Cartao>
      ) : null}

      {!conta ? (
        <Cartao className="flex flex-col gap-4">
          <FormConectarMoodle slug={slug} enderecoInicial={(contas ?? [])[0]?.site?.replace(/^https?:\/\//, "") ?? ""} expirada={expirada} />
        </Cartao>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-marca-clara px-4 py-3 text-sm text-marca-forte">
            <span className="font-semibold [overflow-wrap:anywhere]">
              Conectado como {conta.nome || "?"} · {conta.site_nome || conta.site}
            </span>
            <Link href={`/app/${slug}/contas`} className="font-medium underline">
              Contas conectadas
            </Link>
          </div>

          <Cartao className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold">Qual disciplina o Handback vai corrigir?</h2>
              <p className="text-sm text-suave">Cada disciplina vira {vc.espaco === "Turma" ? "uma turma" : vc.espaco.toLowerCase()} no Handback. Dá para ligar outras depois.</p>
            </div>
            {erroCursos ? <Aviso tipo="erro">{erroCursos}</Aviso> : null}
            {!erroCursos && !livres.length ? (
              <p className="text-sm text-suave">{cursos.length ? "Todas as suas disciplinas já estão ligadas." : "Não encontramos disciplinas suas nesse Moodle."}</p>
            ) : null}
            {livres.length ? (
              <FormAcao acao={ligarDisciplina.bind(null, slug, conta.id)} textoBotao="Criar turma com esta disciplina" textoEnviando="Trazendo do Moodle…">
                <fieldset className="flex flex-col gap-2">
                  <legend className="sr-only">Disciplinas do Moodle</legend>
                  {livres.map((c, i) => (
                    <label
                      key={c.id}
                      className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-borda px-3 py-2 has-[:checked]:border-2 has-[:checked]:border-marca"
                    >
                      <input type="radio" name="curso" value={c.id} defaultChecked={i === 0} className="size-5 shrink-0 accent-[var(--color-marca)]" />
                      <span className="flex flex-col">
                        <span className="font-semibold">{c.fullname}</span>
                        {c.shortname && c.shortname !== c.fullname ? <span className="text-xs text-suave">{c.shortname}</span> : null}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <p className="text-xs text-suave">Vêm junto: os alunos (com nome e e-mail), os grupos do Moodle e as tarefas, que viram {vc.etapas.toLowerCase()}.</p>
              </FormAcao>
            ) : null}
            {ligadas.size ? (
              <div className="text-sm">
                <p className="font-medium">Já ligadas</p>
                <ul className="mt-1 list-disc pl-5 text-suave">
                  {[...ligadas.values()].map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Cartao>
        </>
      )}



    </div>
  );
}

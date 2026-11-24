import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormAcao } from "@/components/form-acao";
import { Campo, Escolha } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario, o } from "@/lib/nomes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";
import { criarTurma } from "../ajustes/acoes";

export const metadata: Metadata = { title: "Nova turma" };

const SELO = { pronto: "bg-ok-fundo text-ok", antes: "bg-alerta-fundo text-alerta" } as const;

/** Nova turma: a primeira pergunta é de onde vêm as entregas (cada turma vem de um lugar só). */
export default async function NovaTurma({ params, searchParams }: PageProps<"/app/[slug]/nova-turma">) {
  const { slug } = await params;
  const { origem } = await searchParams;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const vc = completarVocabulario(empresa.vocabulario);
  const a = o(vc, "espaco");
  const supabase = await criarClienteServidor();
  const [turma, { data: classroom }, { data: moodle }] = await Promise.all([
    turmaAtual(empresa.id),
    supabase.from("conexoes_google").select("invalida").eq("servico", "classroom").maybeSingle(),
    supabase.from("contas_moodle").select("invalida").eq("org_id", empresa.id),
  ]);
  const base = `/app/${slug}`;
  const opcoes = [
    { id: "email", letra: "E", nome: "Por e-mail", detalhe: `Os alunos mandam para o endereço d${a} ${vc.espaco.toLowerCase()}. Não precisa de conta.`, pronto: true, href: `${base}/nova-turma?origem=email`, cor: "bg-marca-clara text-marca-forte" },
    {
      id: "classroom",
      letra: "C",
      nome: "Google Classroom",
      detalhe: `Escolha uma sala sua. Cada sala vira ${a === "a" ? "uma" : "um"} ${vc.espaco.toLowerCase()}.`,
      pronto: Boolean(classroom && !classroom.invalida),
      href: `${base}/configuracoes/classroom`,
      cor: "bg-info-fundo text-info",
    },
    {
      id: "moodle",
      letra: "M",
      nome: "Moodle",
      detalhe: "Escolha uma disciplina do seu Moodle.",
      pronto: (moodle ?? []).some((m) => !m.invalida),
      href: `${base}/moodle`,
      cor: "bg-neutro-fundo text-neutro",
    },
  ];

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">
          Nov{a} {vc.espaco.toLowerCase()}
        </h1>
        <p className="text-sm text-suave">De onde vêm as entregas?</p>
      </div>
      <ul className="flex flex-col gap-2.5">
        {opcoes.map((x) => (
          <li key={x.id}>
            <Link
              href={x.href}
              scroll={false}
              aria-current={origem === x.id ? "true" : undefined}
              className={`toque flex min-h-20 items-center gap-3 rounded-2xl border bg-cartao px-3 py-3 ${origem === x.id ? "border-marca" : "border-borda hover:border-marca"}`}
            >
              <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ${x.cor}`}>
                {x.letra}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{x.nome}</span>
                <span className="text-[13px] text-suave">{x.detalhe}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${x.pronto ? SELO.pronto : SELO.antes}`}>{x.pronto ? "Pronto" : "Conectar antes"}</span>
            </Link>
          </li>
        ))}
      </ul>

      {origem === "email" ? (
        <section aria-label={`Nov${a} ${vc.espaco.toLowerCase()} por e-mail`} className="entra flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
          <h2 className="font-semibold">
            Nov{a} {vc.espaco.toLowerCase()} por e-mail
          </h2>
          <FormAcao acao={criarTurma.bind(null, slug)} textoBotao="Criar" limparAoSalvar confirmar={{ titulo: `Criar est${a} ${vc.espaco.toLowerCase()}?`, sim: "Sim, criar" }}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome" name="nome" required placeholder="Ex.: Cálculo II — Manhã" />
              <Escolha
                rotulo="Quem entrega"
                name="modo"
                defaultValue={turma?.modo ?? "grupos"}
                opcoes={[
                  { valor: "grupos", nome: `${vc.grupos} (com ${vc.pessoas.toLowerCase()} dentro)` },
                  { valor: "individual", nome: `${vc.pessoas} individualmente` },
                ]}
              />
            </div>
          </FormAcao>
        </section>
      ) : null}

      <p className="rounded-2xl bg-alerta-fundo px-4 py-3 text-sm text-alerta">
        Cada {vc.espaco.toLowerCase()} vem de um lugar só. O que ela usa (Drive, agenda, lembretes) fica em Ajustes d{a} {vc.espaco.toLowerCase()}.
      </p>
    </div>
  );
}

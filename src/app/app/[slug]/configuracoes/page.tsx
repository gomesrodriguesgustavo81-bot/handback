import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario, o } from "@/lib/nomes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmasDaEmpresa } from "@/lib/turma";

export const metadata: Metadata = { title: "Configurações" };

type Item = { nome: string; detalhe: string; href: string };

/** Tudo o que vale para a conta inteira, num lugar só (só para quem administra). */
export default async function Configuracoes({ params }: PageProps<"/app/[slug]/configuracoes">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const vc = completarVocabulario(empresa.vocabulario);
  const supabase = await criarClienteServidor();
  const [turmas, { data: config }, { count: pessoas }] = await Promise.all([
    turmasDaEmpresa(empresa.id),
    supabase.from("organizacoes").select("exigir_duas_etapas").eq("id", empresa.id).single(),
    supabase.from("membros").select("user_id", { count: "exact", head: true }).eq("org_id", empresa.id),
  ]);
  const base = `/app/${slug}`;
  const comMoodle = turmas.filter((t) => t.moodle_conta).map((t) => t.nome);
  const ativas = turmas.filter((t) => !t.arquivada).length;

  const grupos: { titulo: string; itens: Item[] }[] = [
    {
      titulo: "Pessoas",
      itens: [
        {
          nome: "Quem usa o Handback",
          detalhe: `${pessoas ?? 0} com acesso · ${vc.avaliadores.toLowerCase()} e administradores · convites`,
          href: `${base}/pessoas`,
        },
      ],
    },
    {
      titulo: `${vc.espacos} e entregas`,
      itens: [
        { nome: vc.espacos, detalhe: `${ativas} ativa(s) · criar, renomear, arquivar`, href: `${base}/configuracoes/turmas` },
        { nome: "Google Drive", detalhe: "Guardar os arquivos das entregas numa pasta do seu Drive", href: `${base}/configuracoes/drive` },
        { nome: "Google Agenda", detalhe: "Os prazos da turma na sua agenda (e, se quiser, na dos alunos)", href: `${base}/configuracoes/agenda` },
        { nome: "Lembretes para os alunos", detalhe: "E-mail de prazo para quem ainda não entregou", href: `${base}/configuracoes/lembretes` },
        { nome: "Receber por e-mail", detalhe: "Endereço de cada turma e a etiqueta do assunto", href: `${base}/configuracoes/recebimento` },
        { nome: "Moodle", detalhe: comMoodle.length ? `Ligado: ${comMoodle.join(", ")}` : "Trazer alunos, tarefas e entregas do Moodle", href: `${base}/moodle` },
      ],
    },
    {
      titulo: "Avaliação",
      itens: [
        { nome: "E-mail (Gmail)", detalhe: "De onde saem as devolutivas · conectar ou desconectar", href: `${base}/configuracoes/email` },
        { nome: "Conceitos e IA", detalhe: "O que vale cada conceito, regra do checklist, exemplos", href: `${base}/configuracoes/avaliacao` },
        {
          nome: "Nomes usados aqui",
          detalhe: [vc.organizacao, vc.espaco, vc.etapa, vc.grupo, vc.pessoa, vc.avaliador].join(", "),
          href: `${base}/configuracoes/nomes`,
        },
      ],
    },
    {
      titulo: "Segurança",
      itens: [
        {
          nome: "Verificação em duas etapas",
          detalhe: config?.exigir_duas_etapas === false ? "Opcional (cada pessoa decide)" : "Obrigatória para todos",
          href: `${base}/configuracoes/seguranca`,
        },
        { nome: "Registro de atividades", detalhe: "Quem fez o quê e quando", href: `${base}/registro` },
      ],
    },
  ];

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-suave">
          Valem para {o(vc, "organizacao")} {vc.organizacao.toLowerCase()} inteir{o(vc, "organizacao")}: {empresa.nome}.
        </p>
      </div>
      {grupos.map((g) => (
        <section key={g.titulo} aria-label={g.titulo} className="flex flex-col gap-1.5">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-suave">{g.titulo}</h2>
          <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-cartao">
            {g.itens.map((i) => (
              <li key={i.nome}>
                <Link href={i.href} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 hover:bg-fundo">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold">{i.nome}</span>
                    <span className="text-xs text-suave [overflow-wrap:anywhere]">{i.detalhe}</span>
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-suave">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

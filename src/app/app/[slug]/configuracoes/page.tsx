import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario, o } from "@/lib/nomes";
import { minusc } from "@/lib/textos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmasDaEmpresa } from "@/lib/turma";
import { passosDoComeco, PrimeirosPassos } from "../primeiros-passos";

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
  const ativas = turmas.filter((t) => !t.arquivada).length;

  const grupos: { titulo: string; itens: Item[] }[] = [
    {
      titulo: "Avaliação",
      itens: [
        { nome: "Conceitos e notas", detalhe: "O que vale cada conceito, a nota no Moodle e no Classroom, a regra do checklist e exemplos para a IA", href: `${base}/configuracoes/avaliacao` },
        { nome: "Devolutiva por e-mail", detalhe: "Seu nome no remetente e cópia para você", href: `${base}/configuracoes/email` },
      ],
    },
    {
      titulo: "Organização",
      itens: [
        { nome: vc.espacos, detalhe: `${ativas} ativa(s) · ${minusc(vc.espaco)} nov${o(vc, "espaco")}, renomear, arquivar`, href: `${base}/configuracoes/turmas` },
        {
          nome: "Nomes usados aqui",
          detalhe: [vc.organizacao, vc.espaco, vc.etapa, vc.grupo, vc.pessoa, vc.avaliador].join(", "),
          href: `${base}/configuracoes/nomes`,
        },
        {
          nome: "Quem usa o Handback",
          detalhe: `${pessoas ?? 0} com acesso · ${vc.avaliadores.toLowerCase()} e administradores · convites`,
          href: `${base}/pessoas`,
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
    {
      titulo: "Você",
      itens: [{ nome: "Aparência", detalhe: "Claro, escuro ou igual ao aparelho (vale só para você)", href: "/conta#aparencia" }],
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
      <PrimeirosPassos passos={await passosDoComeco(slug, empresa)} />
      {grupos.map((g) => (
        <section key={g.titulo} aria-label={g.titulo} className="flex flex-col gap-1.5">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-suave">{g.titulo}</h2>
          <ul className="flex flex-col divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-cartao">
            {g.itens.map((i) => (
              <li key={i.nome}>
                <Link href={i.href} transitionTypes={["nav-forward"]} className="toque flex min-h-14 items-center justify-between gap-3 px-4 py-2.5 hover:bg-fundo">
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
      <Link href={`${base}/contas`} className="toque flex min-h-13 items-center justify-between rounded-2xl bg-marca-clara px-4 font-semibold text-marca-forte">
        Contas conectadas (Gmail, Google, Moodle)
        <span aria-hidden>›</span>
      </Link>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { BarraDeConceitos } from "@/components/coordenacao";
import { Vazio } from "@/components/ui";
import { ROTULO_SINAL } from "@/lib/coordenacao";
import { carregarCoordenacao } from "./dados";

export const metadata: Metadata = { title: "Coordenação" };

export default async function PainelDaCoordenacao({ params }: PageProps<"/app/[slug]/coordenacao">) {
  const { slug } = await params;
  const { empresa, ehCoordenacao, tipo, resumo } = await carregarCoordenacao(slug);

  return (
    <section className="flex flex-col gap-4 sm:max-w-2xl">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight">Coordenação</h1>
          <p className="text-sm text-suave">
            {empresa.nome} · {resumo.turmas.length} {resumo.turmas.length === 1 ? "turma" : "turmas"}
            {tipo === "banca" ? " · banca" : ""}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-marca-clara px-3 py-1.5 text-xs font-bold text-marca-forte">
          {ehCoordenacao ? "Só leitura" : "Prévia de quem avalia"}
        </span>
      </header>

      {!resumo.turmas.length ? (
        <Vazio>{ehCoordenacao ? "Ainda não há turmas para você acompanhar. Peça a quem administra a conta." : "Ainda não há turmas com alunos e entregas cadastrados."}</Vazio>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <Numero rotulo="Entregas recebidas" valor={String(resumo.recebidas)} extra={`de ${resumo.esperadas} esperadas`} classe="border-borda bg-cartao" />
            <Numero rotulo="Já aprovadas" valor={String(resumo.aprovadas)} classe="border-ok/25 bg-ok-fundo text-ok" />
            <Numero rotulo="Com atraso" valor={String(resumo.atrasadas)} classe="border-alerta/25 bg-alerta-fundo text-alerta" />
            <Numero rotulo="Precisam de atenção" valor={String(resumo.atencao)} classe="border-ruim/25 bg-ruim-fundo text-ruim" />
          </dl>

          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-suave">Turmas</h2>
          <ul className="flex flex-col gap-2.5">
            {resumo.turmas.map((t) => {
              const s = ROTULO_SINAL[t.sinal];
              return (
                <li key={t.id}>
                  <Link href={`/app/${slug}/coordenacao/${t.id}`} className="toque flex flex-col gap-2.5 rounded-2xl border border-borda bg-cartao p-4 hover:border-marca/40">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <b className="block break-words text-base">{t.nome}</b>
                        <span className="text-[13px] text-suave">
                          {t.pessoas} {t.modo === "individual" ? (t.pessoas === 1 ? "aluno" : "alunos") : t.pessoas === 1 ? "equipe" : "equipes"}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${s.classe}`}>
                        <span aria-hidden className="mr-1">{s.seta}</span>
                        {s.texto}
                      </span>
                    </span>
                    <BarraDeConceitos conta={t.conceitosAtuais} />
                    <span className="flex justify-between gap-2 text-xs text-suave">
                      <span>
                        {t.atrasadas} {t.atrasadas === 1 ? "atrasada" : "atrasadas"} · {t.atencao} {t.atencao === 1 ? "precisa" : "precisam"} de atenção
                      </span>
                      <b className="text-marca">Abrir ›</b>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="flex items-start gap-2 rounded-2xl bg-marca-clara px-3.5 py-2.5 text-xs leading-relaxed text-marca-forte">
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-px shrink-0">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 018 0v3" />
        </svg>
        <span>Você vê números e conceitos já aprovados. Devolutivas, arquivos dos alunos e a análise da IA ficam só com quem avalia.</span>
      </p>
    </section>
  );
}

function Numero({ rotulo, valor, extra, classe }: { rotulo: string; valor: string; extra?: string; classe: string }) {
  return (
    <div className={`flex flex-col-reverse gap-0.5 rounded-2xl border px-3 py-2.5 ${classe}`}>
      <dt className="text-xs opacity-90">{rotulo}</dt>
      <dd className="text-2xl font-extrabold">
        {valor}
        {extra ? <span className="ml-1.5 text-[13px] font-semibold opacity-80">{extra}</span> : null}
      </dd>
    </div>
  );
}

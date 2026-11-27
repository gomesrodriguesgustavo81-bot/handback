import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarraDeConceitos, NOME_CONCEITO } from "@/components/coordenacao";
import { ROTULO_SINAL } from "@/lib/coordenacao";
import { dataBR } from "@/lib/textos";
import { carregarCoordenacao } from "../dados";

export const metadata: Metadata = { title: "Turma · Coordenação" };

export default async function TurmaDaCoordenacao({ params }: PageProps<"/app/[slug]/coordenacao/[turma]">) {
  const { slug, turma } = await params;
  const { resumo } = await carregarCoordenacao(slug);
  const t = resumo.turmas.find((x) => x.id === turma);
  // Turma fora do escopo (banca) ou que não existe: "não encontrado", sem dizer qual dos dois.
  if (!t) notFound();
  const s = ROTULO_SINAL[t.sinal];
  const comNomes = t.lista.some((p) => p.nome);
  const palavra = t.modo === "individual" ? "alunos" : "equipes";
  const com = t.lista.filter((p) => p.atencao).length;

  return (
    <section className="flex flex-col gap-4 sm:max-w-2xl">
      <Link href={`/app/${slug}/coordenacao`} className="inline-flex min-h-11 items-center text-sm font-semibold text-marca-forte hover:underline">
        ← Coordenação
      </Link>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-extrabold tracking-tight">{t.nome}</h1>
          <p className="text-sm text-suave">{t.pessoas} {palavra}</p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold ${s.classe}`}>
          <span aria-hidden className="mr-1">{s.seta}</span>
          {s.texto}
        </span>
      </header>

      <section aria-label="Conceito por entrega" className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
        <h2 className="text-[15px] font-bold">Conceito aprovado em cada entrega</h2>
        <ul className="flex flex-col gap-3">
          {t.etapas.map((e) => (
            <li key={e.id} className="flex flex-col gap-1.5">
              <span className="flex justify-between gap-2 text-[13px]">
                <b className="min-w-0 break-words">Entrega {e.numero} · {e.titulo}</b>
                <span className="shrink-0 text-suave">{e.aprovadas} de {e.total} aprovadas</span>
              </span>
              <BarraDeConceitos conta={e.conceitos} vazio={e.entregues ? "Entregas recebidas, ainda sem conceito aprovado." : e.prazo ? `Ainda sem entregas · prazo ${dataBR(e.prazo)}` : "Ainda sem entregas."} />
            </li>
          ))}
        </ul>
        {t.mudancaDeRuim && t.mudancaDeRuim.para > t.mudancaDeRuim.de ? (
          <p className="rounded-xl bg-ruim-fundo px-3 py-2.5 text-[13px] leading-relaxed text-ruim">
            <b>O que mudou:</b> a parte de Ruim subiu de {t.mudancaDeRuim.de} para {t.mudancaDeRuim.para} entre a entrega {t.mudancaDeRuim.entre[0]} e a {t.mudancaDeRuim.entre[1]}.
          </p>
        ) : null}
      </section>

      <section aria-label="Prazo e atenção" className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-borda bg-cartao p-3">
          <p className="text-xs text-suave">Recebidas</p>
          <p className="mt-1 text-2xl font-extrabold">{t.recebidas} <span className="text-[13px] font-semibold text-suave">de {t.esperadas}</span></p>
          <p className="text-xs text-alerta">{t.atrasadas} {t.atrasadas === 1 ? "chegou atrasada" : "chegaram atrasadas"}</p>
        </div>
        <div className="rounded-2xl border border-borda bg-cartao p-3">
          <p className="text-xs text-suave">Precisam de atenção</p>
          <p className="mt-1 text-2xl font-extrabold text-ruim">{com} <span className="text-[13px] font-semibold">{com === 1 ? palavra.slice(0, -1) : palavra}</span></p>
          <p className="text-xs text-suave">Ruim ou caíram de conceito</p>
        </div>
      </section>

      {comNomes ? (
        <section aria-label="Conceitos por pessoa" className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-suave">{palavra === "alunos" ? "Alunos" : "Equipes"} (conceito aprovado)</h2>
          <ul className="flex flex-col gap-1.5">
            {t.lista.map((p) => (
              <li key={p.n} className="flex items-center justify-between gap-3 rounded-xl border border-borda bg-cartao px-3 py-2.5">
                <span className="min-w-0 text-sm">
                  <b className="break-words">{p.nome}</b>
                  <br />
                  <span className="text-xs text-suave">
                    {p.anterior && p.atual ? `${NOME_CONCEITO[p.anterior]} → ${NOME_CONCEITO[p.atual]}` : p.atual ? NOME_CONCEITO[p.atual] : "Ainda sem conceito aprovado"}
                  </span>
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {p.atual ? <span className="rounded-full bg-neutro-fundo px-2.5 py-1 text-xs font-bold">{NOME_CONCEITO[p.atual]}</span> : null}
                  {p.atrasos ? <span className="rounded-full bg-alerta-fundo px-2.5 py-1 text-xs font-bold text-alerta">Atrasou</span> : null}
                  {p.atencao ? <span className="rounded-full bg-ruim-fundo px-2.5 py-1 text-xs font-bold text-ruim">Atenção</span> : null}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-suave">Tocar numa pessoa não abre a correção: aqui só aparecem os conceitos já aprovados.</p>
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-borda px-4 py-3 text-xs leading-relaxed text-suave">
          Os nomes dos {palavra} não aparecem para a coordenação, só os números. Quem administra a conta pode mudar isso ao convidar de novo.
        </p>
      )}
    </section>
  );
}

import Link from "next/link";
import { SimboloHandback } from "./marca";
import { contato } from "./rodape";
import { IDIOMAS, TEXTOS, type Idioma } from "@/lib/vendas";

function Check({ className = "" }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

const ICONE_ITEM = {
  ok: { classe: "bg-ok-fundo text-ok", d: "M5 12.5l4.5 4.5L19 7.5" },
  parcial: { classe: "bg-reg-fundo text-reg", d: "M6 12h12" },
  falta: { classe: "bg-ruim-fundo text-ruim", d: "M7 7l10 10M17 7L7 17" },
} as const;

/** Página de entrada (vitrine) do Handback, em português, inglês ou espanhol. */
export function PaginaDeVendas({ idioma }: { idioma: Idioma }) {
  const t = TEXTOS[idioma];
  const info = IDIOMAS.find((i) => i.id === idioma)!;
  const email = contato();
  // Em português, o cadastro é sozinho; nos outros idiomas (o app ainda é só em português), fala com a gente.
  const testar = idioma === "pt" ? "/criar-conta" : email ? `mailto:${email}?subject=${encodeURIComponent(t.assuntoEmail)}` : "/entrar";
  const secao = "mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 sm:px-6";
  const tituloSecao = "text-[28px] font-extrabold leading-tight tracking-tight sm:text-4xl";

  return (
    <div lang={info.html} className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-borda bg-cartao/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href={info.caminho} className="inline-flex items-center gap-2 font-semibold tracking-tight text-texto" aria-label="Handback">
            <SimboloHandback tamanho={30} desenha />
            <span className="titulo text-[21px] font-extrabold tracking-[-0.03em]">handback</span>
          </Link>
          <nav aria-label="Menu" className="hidden items-center gap-6 text-sm font-semibold text-suave lg:flex">
            <a href="#como" className="hover:text-texto">
              {t.menu.como}
            </a>
            <a href="#controle" className="hover:text-texto">
              {t.menu.controle}
            </a>
            <a href="#seguranca" className="hover:text-texto">
              {t.menu.seguranca}
            </a>
            <a href="#perguntas" className="hover:text-texto">
              {t.menu.perguntas}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <nav aria-label="Idioma / Language" className="hidden rounded-lg border border-borda bg-cartao p-0.5 text-xs font-semibold sm:flex">
              {IDIOMAS.map((i) => (
                <Link
                  key={i.id}
                  href={i.caminho}
                  hrefLang={i.html}
                  lang={i.html}
                  aria-label={i.nome}
                  aria-current={i.id === idioma ? "true" : undefined}
                  className={`flex min-h-8 min-w-9 items-center justify-center rounded-md px-1.5 ${i.id === idioma ? "bg-texto text-fundo" : "text-suave hover:text-texto"}`}
                >
                  {i.sigla}
                </Link>
              ))}
            </nav>
            <Link href="/entrar" className="toque inline-flex min-h-10 items-center rounded-xl border border-borda bg-cartao px-3.5 text-sm font-semibold hover:bg-fundo">
              {t.menu.entrar}
            </Link>
            <a href={testar} className="toque hidden min-h-10 items-center rounded-xl bg-marca px-4 text-sm font-bold text-sobre-marca hover:bg-marca-forte md:inline-flex">
              {t.menu.criar}
            </a>
          </div>
        </div>
      </header>

      <main className="flex flex-col">
        {/* Abertura */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="flex flex-col gap-5">
            <span className="self-start rounded-full bg-marca-clara px-3.5 py-1.5 text-xs font-bold text-marca-forte sm:text-[13px]">{t.hero.selo}</span>
            <h1 className="text-[38px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-[58px]">
              {t.hero.titulo1} <span className="text-marca">{t.hero.titulo2}</span>
            </h1>
            <p className="max-w-xl text-[17px] leading-relaxed text-suave sm:text-lg">{t.hero.texto}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a href={testar} className="toque inline-flex min-h-13 items-center justify-center rounded-2xl bg-marca px-6 text-[17px] font-extrabold text-sobre-marca hover:bg-marca-forte">
                {t.hero.testar}
              </a>
              <a href="#como" className="toque inline-flex min-h-13 items-center justify-center rounded-2xl border border-borda bg-cartao px-5 text-[17px] font-semibold hover:bg-fundo">
                {t.hero.verComo}
              </a>
            </div>
            <p className="text-sm text-suave">
              {t.hero.funcionaCom} <b className="text-texto">{t.hero.integracoes}</b>
            </p>
          </div>

          {/* Prévia do produto (desenhada, sem imagem) */}
          <div aria-hidden className="flex flex-col gap-3.5 rounded-[28px] bg-marca-clara p-4 sm:p-5">
            <div className="flex flex-col gap-3 rounded-[20px] bg-cartao p-4 shadow-[0_8px_24px_rgb(15_26_51/0.08)]">
              <span className="flex justify-between gap-2">
                <b>{t.previa.ciclo}</b>
                <span className="text-xs text-suave">{t.previa.turma}</span>
              </span>
              <span className="grid grid-cols-5 gap-1.5 text-center text-[11px] font-bold">
                {t.previa.passos.map((p, i) => (
                  <span key={p} className={`rounded-lg px-0.5 py-2 ${i < 3 ? "bg-ok-fundo text-ok" : i === 3 ? "bg-marca text-sobre-marca" : "bg-fundo text-suave"}`}>
                    {i < 3 ? "✓ " : ""}
                    {p}
                  </span>
                ))}
              </span>
            </div>
            <div className="flex flex-col gap-3 rounded-[20px] bg-cartao p-4 shadow-[0_8px_24px_rgb(15_26_51/0.08)]">
              <span className="flex items-center justify-between">
                <b>{t.previa.aluno}</b>
                <span className="rounded-full bg-bom-fundo px-2.5 py-0.5 text-xs font-extrabold text-bom">{t.previa.conceito}</span>
              </span>
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {t.previa.itens.map((i) => (
                  <li key={i.item} className="flex items-center gap-2">
                    <span className={`flex size-5 shrink-0 items-center justify-center rounded-md ${ICONE_ITEM[i.status].classe}`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d={ICONE_ITEM[i.status].d} />
                      </svg>
                    </span>
                    {i.item}
                  </li>
                ))}
              </ul>
              <p className="rounded-xl bg-fundo p-3 text-[13px] leading-relaxed">{t.previa.devolutiva}</p>
              <span className="flex items-center justify-between gap-3">
                <span className="text-xs text-suave">{t.previa.ia}</span>
                <span className="rounded-xl bg-marca px-3.5 py-2 text-[13px] font-bold text-sobre-marca">{t.previa.aprovar}</span>
              </span>
            </div>
          </div>
        </section>

        {/* Como funciona: os 5 passos */}
        <section id="como" className="scroll-mt-20 bg-cartao py-16">
          <div className={secao}>
            <h2 className={tituloSecao}>{t.como.titulo}</h2>
            <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {t.como.passos.map((p, n) => (
                <li key={p.titulo} className="flex flex-col gap-2 rounded-[20px] bg-fundo p-5">
                  <span className="text-[13px] font-extrabold text-marca">{n + 1}</span>
                  <h3 className="text-[17px] font-bold">{p.titulo}</h3>
                  <p className="text-sm leading-relaxed text-suave">{p.texto}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Você no controle */}
        <section id="controle" className="scroll-mt-20 py-16">
          <div className={secao}>
            <h2 className={tituloSecao}>{t.controle.titulo}</h2>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {t.controle.itens.map((i) => (
                <li key={i.titulo} className="flex flex-col gap-2.5 rounded-[22px] bg-cartao p-6 shadow-cartao">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-marca-clara text-marca-forte">
                    <Check />
                  </span>
                  <h3 className="text-lg font-bold">{i.titulo}</h3>
                  <p className="leading-relaxed text-suave">{i.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Segurança */}
        <section id="seguranca" className="scroll-mt-20 bg-barra py-16 text-white">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:items-center">
            <div className="flex flex-col gap-3">
              <h2 className={tituloSecao}>{t.seguranca.titulo}</h2>
              <p className="text-lg leading-relaxed text-white/75">{t.seguranca.texto}</p>
              <Link href="/privacidade" className="self-start font-semibold text-white underline">
                {t.seguranca.politica}
              </Link>
            </div>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {t.seguranca.itens.map((i) => (
                <li key={i} className="flex items-start gap-2.5 rounded-2xl bg-white/[0.07] p-4 text-[15px] leading-snug">
                  <span className="mt-0.5 text-[#a9bdff]">
                    <Check />
                  </span>
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Perguntas */}
        <section id="perguntas" className="scroll-mt-20 py-16">
          <div className={secao}>
            <h2 className={tituloSecao}>{t.perguntas.titulo}</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start">
              {t.perguntas.itens.map((q) => (
                <details key={q.p} className="dobra group rounded-[18px] bg-cartao shadow-cartao">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 font-bold [&::-webkit-details-marker]:hidden">
                    {q.p}
                    <span aria-hidden className="text-xl text-suave transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="px-5 pb-5 leading-relaxed text-suave">{q.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final */}
        <section className="bg-marca-clara">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-[40px]">{t.final.titulo}</h2>
            <p className="text-lg text-suave">{t.final.texto}</p>
            <a href={testar} className="toque inline-flex min-h-14 items-center justify-center rounded-2xl bg-marca px-8 text-lg font-extrabold text-sobre-marca hover:bg-marca-forte">
              {t.final.botao}
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-borda py-6 text-sm text-suave">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 sm:px-6">
          <span>© {new Date().getFullYear()} Handback</span>
          <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/privacidade" className="hover:text-texto hover:underline">
              {t.rodape.privacidade}
            </Link>
            <Link href="/termos" className="hover:text-texto hover:underline">
              {t.rodape.termos}
            </Link>
            {email ? (
              <a href={`mailto:${email}`} className="hover:text-texto hover:underline">
                {t.rodape.contato}
              </a>
            ) : null}
            <nav aria-label="Idioma / Language" className="flex gap-1 sm:hidden">
              {IDIOMAS.map((i) => (
                <Link key={i.id} href={i.caminho} hrefLang={i.html} lang={i.html} aria-label={i.nome} className={`px-1.5 ${i.id === idioma ? "font-bold text-texto" : ""}`}>
                  {i.sigla}
                </Link>
              ))}
            </nav>
          </span>
          {t.rodape.aviso ? <span className="w-full text-center text-xs">{t.rodape.aviso}</span> : null}
        </div>
      </footer>
    </div>
  );
}

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

function BotaoTestar({ href, texto, grande = false }: { href: string; texto: string; grande?: boolean }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center rounded-xl bg-marca font-semibold text-sobre-marca hover:bg-marca-forte ${grande ? "min-h-12 px-6 text-lg" : "min-h-11 px-5"}`}
    >
      {texto}
    </a>
  );
}

/** Página de vendas (vitrine) do Handback, em português, inglês ou espanhol. */
export function PaginaDeVendas({ idioma }: { idioma: Idioma }) {
  const t = TEXTOS[idioma];
  const info = IDIOMAS.find((i) => i.id === idioma)!;
  const email = contato();
  const testar = email ? `mailto:${email}?subject=${encodeURIComponent(t.assuntoEmail)}` : "/entrar";

  return (
    <div lang={info.html} className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-borda bg-fundo/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href={info.caminho} className="inline-flex items-center gap-2 font-semibold tracking-tight text-texto" aria-label="Handback">
            <SimboloHandback tamanho={30} />
            <span className="titulo text-[21px] font-extrabold tracking-[-0.04em]">handback</span>
          </Link>
          <nav aria-label="Menu" className="hidden items-center gap-5 text-sm font-medium text-suave md:flex">
            <a href="#como" className="hover:text-texto">
              {t.menu.como}
            </a>
            <a href="#recursos" className="hover:text-texto">
              {t.menu.recursos}
            </a>
            <a href="#seguranca" className="hover:text-texto">
              {t.menu.seguranca}
            </a>
            <a href="#perguntas" className="hover:text-texto">
              {t.menu.perguntas}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <nav aria-label="Idioma / Language" className="flex rounded-lg border border-borda bg-cartao p-0.5 text-xs font-semibold">
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
            <Link href="/entrar" className="hidden min-h-10 items-center rounded-xl border border-borda bg-cartao px-3 text-sm font-medium hover:bg-fundo sm:inline-flex">
              {t.menu.entrar}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-col">
        {/* Abertura */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col gap-5">
            <span className="self-start rounded-full bg-marca-clara px-3 py-1 text-xs font-semibold text-marca-forte">{t.hero.selo}</span>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              {t.hero.titulo1} <span className="text-marca">{t.hero.titulo2}</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-suave">{t.hero.texto}</p>
            <div className="flex flex-wrap gap-3">
              <BotaoTestar href={testar} texto={t.hero.testar} grande />
              <Link href="/entrar" className="inline-flex min-h-12 items-center rounded-xl border border-borda bg-cartao px-5 text-lg font-medium hover:bg-fundo">
                {t.hero.entrar}
              </Link>
            </div>
            <p className="text-sm text-suave">{t.hero.nota}</p>
          </div>

          {/* Prévia do produto (desenhada, sem imagem) */}
          <div aria-hidden className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-marca-clara/60" />
            <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{t.previa.equipe}</p>
                  <p className="text-xs text-suave">{t.previa.etapa}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-suave">{t.previa.conceito}</span>
                  <span className="rounded-lg bg-bom-fundo px-2.5 py-1 text-sm font-bold tracking-wide text-bom">{t.previa.conceitoValor}</span>
                </div>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-suave">{t.previa.pedido}</p>
              <ul className="flex flex-col gap-2">
                {t.previa.itens.map((i) => (
                  <li key={i.item} className="flex items-start gap-2.5">
                    <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${ICONE_ITEM[i.status].classe}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d={ICONE_ITEM[i.status].d} />
                      </svg>
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">{i.item}</span>
                      <span className="text-xs text-suave">{i.nota}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-suave">{t.previa.devolutiva}</p>
              <p className="rounded-xl border border-borda bg-fundo p-3 text-sm leading-relaxed">{t.previa.devolutivaTexto}</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-suave">{t.previa.ia}</span>
                <span className="rounded-xl bg-marca px-3.5 py-2 text-sm font-semibold text-sobre-marca">{t.previa.aprovar}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Dor */}
        <section className="border-y border-borda bg-cartao">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-14 sm:px-6">
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">{t.dor.titulo}</h2>
            <ul className="grid gap-4 sm:grid-cols-3">
              {t.dor.itens.map((i) => (
                <li key={i.titulo} className="flex flex-col gap-1.5">
                  <h3 className="font-semibold">{i.titulo}</h3>
                  <p className="text-suave">{i.texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como" className="mx-auto flex w-full max-w-6xl scroll-mt-20 flex-col gap-6 px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.como.titulo}</h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {t.como.passos.map((p, n) => (
              <li key={p.titulo} className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-marca text-sm font-bold text-sobre-marca">{n + 1}</span>
                <h3 className="text-lg font-semibold">{p.titulo}</h3>
                <p className="text-suave">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Para quem */}
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.paraQuem.titulo}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {t.paraQuem.itens.map((i) => (
              <li key={i.titulo} className="flex flex-col gap-1 rounded-2xl bg-marca-clara p-4">
                <h3 className="font-semibold text-marca-forte">{i.titulo}</h3>
                <p className="text-sm text-texto">{i.texto}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Recursos */}
        <section id="recursos" className="scroll-mt-20 border-y border-borda bg-cartao">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6">
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">{t.recursos.titulo}</h2>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {t.recursos.itens.map((i) => (
                <li key={i.titulo} className="flex gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-marca-clara text-marca-forte">
                    <Check />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="font-semibold">{i.titulo}</h3>
                    <p className="text-suave">{i.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Segurança */}
        <section id="seguranca" className="mx-auto grid w-full max-w-6xl scroll-mt-20 gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.seguranca.titulo}</h2>
            <p className="text-lg text-suave">{t.seguranca.texto}</p>
            <Link href="/privacidade" className="self-start font-semibold text-marca-forte underline">
              {t.seguranca.politica}
            </Link>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {t.seguranca.itens.map((i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-xl border border-borda bg-cartao p-3.5">
                <span className="mt-0.5 text-marca">
                  <Check />
                </span>
                <span className="text-sm font-medium">{i}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Planos */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
          <div className="flex flex-col items-start gap-4 rounded-3xl bg-texto p-8 text-fundo sm:flex-row sm:items-center sm:justify-between">
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{t.planos.titulo}</h2>
              <p className="opacity-85">{t.planos.texto}</p>
            </div>
            <a href={testar} className="inline-flex min-h-12 shrink-0 items-center rounded-xl bg-fundo px-5 font-semibold text-texto hover:opacity-90">
              {t.planos.botao}
            </a>
          </div>
        </section>

        {/* Perguntas */}
        <section id="perguntas" className="mx-auto flex w-full max-w-3xl scroll-mt-20 flex-col gap-4 px-4 pb-16 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.perguntas.titulo}</h2>
          <div className="flex flex-col gap-2">
            {t.perguntas.itens.map((q) => (
              <details key={q.p} className="group rounded-2xl border border-borda bg-cartao">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {q.p}
                  <span aria-hidden className="text-suave transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="px-4 pb-4 text-suave">{q.r}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final */}
        <section className="border-t border-borda bg-marca-clara">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">{t.final.titulo}</h2>
            <p className="text-lg text-suave">{t.final.texto}</p>
            <BotaoTestar href={testar} texto={t.final.botao} grande />
          </div>
        </section>
      </main>

      <footer className="border-t border-borda py-6 text-sm text-suave">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 sm:px-6">
          <span>© {new Date().getFullYear()} Handback</span>
          <Link href="/privacidade" className="hover:text-texto hover:underline">
            {t.rodape.privacidade}
          </Link>
          <Link href="/termos" className="hover:text-texto hover:underline">
            {t.rodape.termos}
          </Link>
          {t.rodape.aviso ? <span className="w-full text-center text-xs">{t.rodape.aviso}</span> : null}
        </div>
      </footer>
    </div>
  );
}

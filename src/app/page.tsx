import Link from "next/link";
import { Marca } from "@/components/marca";

const PASSOS = [
  { titulo: "Recebe", texto: "A entrega chega por e-mail ou pelo site, já separada por empresa, etapa e equipe." },
  { titulo: "Confere", texto: "A IA confere o checklist do que foi pedido e analisa a qualidade, sem dar nota." },
  { titulo: "Aprova", texto: "Uma pessoa revisa o conceito e a devolutiva, edita se quiser e aprova." },
  { titulo: "Devolve", texto: "A devolutiva sai na mesma conversa, e a evolução de cada um fica registrada." },
];

const FRENTES = [
  { titulo: "Escolas e cursos", texto: "Alunos entregam, professores avaliam." },
  { titulo: "Empresas", texto: "O time entrega, o gestor dá o retorno." },
  { titulo: "Consultorias", texto: "Entregáveis revisados antes de ir ao cliente." },
  { titulo: "Contabilidade e advocacia", texto: "O cliente manda os documentos; o escritório confere o que falta." },
];

export default function Inicio() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Marca />
        <Link
          href="/entrar"
          className="inline-flex min-h-11 items-center rounded-xl border border-borda bg-cartao px-4 font-medium hover:bg-fundo"
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-14 px-4 pb-16 pt-8 sm:px-6 sm:pt-16">
        <section className="flex flex-col gap-5">
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Você recebe, a gente <span className="text-marca">devolve conferido.</span>
          </h1>
          <p className="max-w-2xl text-lg text-suave">
            O Handback recebe entregas, confere com IA o que foi pedido e devolve uma avaliação aprovada por uma pessoa.
            Nada sai sem revisão humana.
          </p>
          <div>
            <Link
              href="/entrar"
              className="inline-flex min-h-12 items-center rounded-xl bg-marca px-5 text-lg font-medium text-sobre-marca hover:bg-marca-forte"
            >
              Entrar no Handback
            </Link>
          </div>
        </section>

        <section aria-labelledby="como" className="flex flex-col gap-4">
          <h2 id="como" className="text-xl font-semibold">Como funciona</h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="rounded-2xl border border-borda bg-cartao p-5">
                <span className="text-sm font-medium text-marca">{i + 1}</span>
                <h3 className="mt-1 text-lg font-semibold">{p.titulo}</h3>
                <p className="mt-1 text-suave">{p.texto}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="para-quem" className="flex flex-col gap-4">
          <h2 id="para-quem" className="text-xl font-semibold">Para quem</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {FRENTES.map((f) => (
              <li key={f.titulo} className="rounded-2xl border border-borda bg-cartao p-5">
                <h3 className="font-semibold">{f.titulo}</h3>
                <p className="mt-1 text-suave">{f.texto}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-borda py-6 text-center text-sm text-suave">
        © {new Date().getFullYear()} Handback · Todos os direitos reservados
      </footer>
    </div>
  );
}

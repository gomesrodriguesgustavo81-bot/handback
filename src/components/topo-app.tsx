import Link from "next/link";
import { Marca } from "./marca";

/** Barra do topo das áreas logadas. */
export function TopoApp({ email, dono }: { email: string; dono: boolean }) {
  return (
    <header className="border-b border-borda bg-cartao print:hidden">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Marca />
        <nav className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/app" className="rounded-lg px-3 py-2 hover:bg-fundo">
            Minhas empresas
          </Link>
          <Link href="/conta" className="rounded-lg px-3 py-2 hover:bg-fundo">
            Minha conta
          </Link>
          {dono ? (
            <Link href="/admin" className="rounded-lg px-3 py-2 hover:bg-fundo">
              Painel do dono
            </Link>
          ) : null}
          <form action="/sair" method="post">
            <button type="submit" className="rounded-lg px-3 py-2 text-suave hover:bg-fundo" title={email}>
              Sair
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

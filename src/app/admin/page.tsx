import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, Selo } from "@/components/ui";
import { FRENTES } from "@/lib/frentes";
import { minhasEmpresas } from "@/lib/sessao";
import { mudarStatus } from "./actions";
import { NovaEmpresa } from "./nova-empresa";

export const metadata: Metadata = { title: "Administração do Handback" };

export default async function PainelDono() {
  const empresas = await minhasEmpresas();

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Administração do Handback</h1>
        <p className="text-suave">Todas as empresas que usam o Handback.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Empresas ({empresas.length})</h2>
          {empresas.length === 0 ? (
            <Cartao>
              <p className="text-suave">Nenhuma empresa ainda. Crie a primeira ao lado.</p>
            </Cartao>
          ) : (
            <ul className="flex flex-col gap-3">
              {empresas.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-borda bg-cartao p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/app/${e.slug}`} className="font-semibold hover:text-marca">
                        {e.nome}
                      </Link>
                      {e.ativa ? <Selo>Ativa</Selo> : <Selo>Bloqueada</Selo>}
                    </div>
                    <p className="text-sm text-suave">
                      {FRENTES[e.frente].curto} · /{e.slug}
                    </p>
                  </div>
                  <form action={mudarStatus}>
                    <input type="hidden" name="id" value={e.id} />
                    <input type="hidden" name="ativa" value={String(!e.ativa)} />
                    <button type="submit" className="min-h-11 rounded-xl border border-borda px-3 text-sm hover:bg-fundo">
                      {e.ativa ? "Bloquear" : "Liberar"}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Cartao className="flex flex-col gap-4 self-start">
          <h2 className="font-semibold">Nova empresa</h2>
          <NovaEmpresa />
        </Cartao>
      </div>
    </>
  );
}

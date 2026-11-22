import type { Metadata } from "next";
import Link from "next/link";
import { Cartao, Selo } from "@/components/ui";
import { FRENTES, PAPEIS } from "@/lib/frentes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { eDonoDaPlataforma, minhasEmpresas, usuarioAtual } from "@/lib/sessao";

export const metadata: Metadata = { title: "Minhas empresas" };

export default async function MinhasEmpresas() {
  const eu = await usuarioAtual();
  // Se alguém foi convidado depois que a pessoa já tinha entrado, aceita agora.
  const supabase = await criarClienteServidor();
  await supabase.rpc("aceitar_convites");

  const [empresas, dono] = await Promise.all([minhasEmpresas(), eDonoDaPlataforma()]);
  const minhas = empresas.filter((e) => e.papel !== null || e.meuGrupo !== null);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Minhas empresas</h1>
        <p className="text-suave">Entrou como {eu.email}</p>
      </div>

      {minhas.length === 0 ? (
        <Cartao>
          <p className="font-medium">Você ainda não faz parte de nenhuma empresa.</p>
          <p className="mt-1 text-suave">
            {dono
              ? "Crie a primeira empresa no Painel do dono."
              : "Peça ao administrador da sua empresa um convite para este e-mail."}
          </p>
        </Cartao>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {minhas.map((e) => (
            <li key={e.id}>
              <Link href={`/app/${e.slug}`} className="block rounded-2xl border border-borda bg-cartao p-5 hover:border-marca">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{e.nome}</span>
                  {!e.ativa ? <Selo>Bloqueada</Selo> : null}
                </div>
                <p className="mt-1 text-sm text-suave">
                  {FRENTES[e.frente].curto} ·{" "}
                  {e.papel ? PAPEIS[e.papel] : `Entrega por ${e.vocabulario.grupo.toLowerCase()} · ${e.meuGrupo?.nome}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

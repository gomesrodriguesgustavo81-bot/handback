import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Cartao, Selo } from "@/components/ui";
import { FRENTES, PAPEIS } from "@/lib/frentes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { eDonoDaPlataforma, minhasEmpresas, usuarioAtual } from "@/lib/sessao";

export const metadata: Metadata = { title: "Seus espaços" };

export default async function MinhasEmpresas({ searchParams }: PageProps<"/app">) {
  const { todas } = await searchParams;
  const eu = await usuarioAtual();
  // Se alguém foi convidado depois que a pessoa já tinha entrado, aceita agora.
  const supabase = await criarClienteServidor();
  await supabase.rpc("aceitar_convites");

  const [empresas, dono] = await Promise.all([minhasEmpresas(), eDonoDaPlataforma()]);
  // O dono do Handback vê todas as contas; as outras pessoas, só as suas.
  const minhas = dono ? empresas : empresas.filter((e) => e.papel !== null);
  // Quem faz parte de uma empresa só vai direto para ela.
  if (minhas.length === 1 && !dono && todas !== "1") redirect(`/app/${minhas[0].slug}`);

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Seus espaços</h1>
        <p className="text-suave">Entrou como {eu.email}</p>
      </div>

      {minhas.length === 0 ? (
        <Cartao>
          <p className="font-medium">Você ainda não faz parte de nenhum espaço.</p>
          <p className="mt-1 text-suave">
            {dono
              ? "Crie a primeira conta de cliente em Administração do Handback (no menu do seu círculo, no topo)."
              : "Peça a quem administra o seu espaço um convite para este e-mail."}
          </p>
        </Cartao>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {minhas.map((e) => (
            <li key={e.id}>
              <Link href={`/app/${e.slug}`} className="block rounded-2xl border border-borda bg-cartao p-5 hover:border-marca">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{e.nome}</span>
                  {!e.ativa ? <Selo>Bloqueada</Selo> : null}
                </div>
                <p className="mt-1 text-sm text-suave">
                  {FRENTES[e.frente].curto} · {e.papel ? PAPEIS[e.papel] : "você é o dono do Handback"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

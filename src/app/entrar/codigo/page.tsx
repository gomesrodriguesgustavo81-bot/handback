import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TelaSimples } from "@/components/tela-simples";
import { caminhoSeguro } from "@/lib/caminhos";
import { sessaoBasica } from "@/lib/sessao";
import { FormCodigo } from "../../conta/formularios";

export const metadata: Metadata = { title: "Código de verificação" };

export default async function Codigo({ searchParams }: PageProps<"/entrar/codigo">) {
  const { voltar } = await searchParams;
  const destino = caminhoSeguro(voltar);
  const s = await sessaoBasica();
  if (!s.temSegundaEtapa) redirect("/conta/duas-etapas");
  if (s.nivel === "aal2") redirect(destino);
  return (
    <TelaSimples
      titulo="Verificação em duas etapas"
      rodape={
        <form action="/sair" method="post">
          Perdeu o celular? Fale com o administrador da sua empresa. ·{" "}
          <button type="submit" className="underline hover:text-texto">
            Sair
          </button>
        </form>
      }
    >
      <p className="text-sm text-suave">Abra o app autenticador no seu celular e digite o código do Handback.</p>
      <FormCodigo voltar={destino} />
    </TelaSimples>
  );
}

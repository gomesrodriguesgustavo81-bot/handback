import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TelaSimples } from "@/components/tela-simples";
import { sessaoBasica } from "@/lib/sessao";
import { FormRecuperar } from "../../conta/formularios";

export const metadata: Metadata = { title: "Perdi o celular" };

export default async function Recuperar() {
  const s = await sessaoBasica();
  if (!s.temSegundaEtapa) redirect("/conta/duas-etapas");
  if (s.nivel === "aal2") redirect("/conta");
  return (
    <TelaSimples
      titulo="Perdi o celular"
      rodape={
        <Link href="/entrar/codigo" className="underline hover:text-texto">
          Voltar e digitar o código do celular
        </Link>
      }
    >
      <p className="text-sm text-suave">
        Digite um dos códigos de recuperação que você guardou quando ativou a verificação em duas etapas. Ele desliga a verificação, e você
        cadastra o celular novo em seguida. Cada código vale uma vez.
      </p>
      <FormRecuperar />
      <p className="text-xs text-suave">Não guardou os códigos? Fale com o administrador da sua empresa.</p>
    </TelaSimples>
  );
}

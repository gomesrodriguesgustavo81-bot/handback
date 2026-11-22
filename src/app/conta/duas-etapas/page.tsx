import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TelaSimples } from "@/components/tela-simples";
import { sessaoBasica } from "@/lib/sessao";
import { CadastroDuasEtapas } from "../formularios";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default async function DuasEtapas() {
  const s = await sessaoBasica();
  if (!s.senhaDefinida) redirect("/definir-senha");
  if (s.temSegundaEtapa) redirect(s.nivel === "aal2" ? "/conta" : "/entrar/codigo");
  return (
    <TelaSimples
      titulo="Proteja sua conta"
      rodape={
        <form action="/sair" method="post">
          <button type="submit" className="underline hover:text-texto">
            Sair
          </button>
        </form>
      }
    >
      <p className="text-sm text-suave">
        Além da senha, o Handback vai pedir um código do seu celular para entrar. Assim, mesmo que alguém descubra sua senha,
        não consegue acessar os documentos. Leva 1 minuto.
      </p>
      <CadastroDuasEtapas />
    </TelaSimples>
  );
}

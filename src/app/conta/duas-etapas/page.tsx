import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TelaSimples } from "@/components/tela-simples";
import { sessaoBasica } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CadastroDuasEtapas } from "../formularios";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default async function DuasEtapas() {
  const s = await sessaoBasica();
  if (!s.senhaDefinida) redirect("/definir-senha");
  if (s.temSegundaEtapa) redirect(s.nivel === "aal2" ? "/conta" : "/entrar/codigo");
  const { data: fim } = await (await criarClienteServidor()).rpc("fim_da_experiencia");
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
      {fim ? (
        <Link href="/app" className="self-center text-sm font-medium text-marca-forte underline">
          Fazer depois (até {new Date(String(fim)).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })})
        </Link>
      ) : null}
    </TelaSimples>
  );
}

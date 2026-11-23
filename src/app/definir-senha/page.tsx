import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TelaSimples } from "@/components/tela-simples";
import { sessaoBasica } from "@/lib/sessao";
import { FormSenha } from "../conta/formularios";

export const metadata: Metadata = { title: "Criar senha" };

export default async function DefinirSenha() {
  const s = await sessaoBasica();
  // Trocar a senha de quem já tem as 2 etapas exige o código antes.
  if (s.temSegundaEtapa && s.nivel !== "aal2") redirect("/entrar/codigo?voltar=/definir-senha");
  return (
    <TelaSimples titulo={s.senhaDefinida ? "Trocar a senha" : "Crie sua senha"}>
      <p className="break-words text-sm text-suave">
        Conta: <strong className="text-texto">{s.email}</strong>
      </p>
      <FormSenha pedirNome={!s.nome} />
    </TelaSimples>
  );
}

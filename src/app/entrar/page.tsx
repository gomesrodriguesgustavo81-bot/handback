import type { Metadata } from "next";
import { Marca } from "@/components/marca";
import { Aviso, Cartao } from "@/components/ui";
import { SemConfiguracao } from "@/components/sem-configuracao";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { caminhoSeguro } from "@/lib/caminhos";
import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

const ERROS: Record<string, string> = {
  link: "O link de acesso expirou ou já foi usado. Peça um novo abaixo.",
};

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const voltar = caminhoSeguro(params.voltar);
  const erro = typeof params.erro === "string" ? ERROS[params.erro] : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Marca tamanho="lg" />
        </div>
        <Cartao className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold">Entrar</h1>
          {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
          {supabaseConfigurado() ? <FormularioEntrar voltar={voltar} /> : <SemConfiguracao />}
        </Cartao>
        <p className="text-center text-sm text-suave">
          Ainda não tem acesso? Peça um convite ao administrador da sua empresa.
        </p>
      </div>
    </main>
  );
}

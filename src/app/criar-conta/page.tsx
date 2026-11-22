import type { Metadata } from "next";
import { Marca } from "@/components/marca";
import { FormCadastro } from "./formulario";

export const metadata: Metadata = { title: "Criar minha conta" };

export default function CriarConta() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="relative flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Marca tamanho="lg" />
          <p className="text-sm text-suave">Você recebe, a gente devolve conferido.</p>
        </div>
        <FormCadastro />
      </div>
    </main>
  );
}

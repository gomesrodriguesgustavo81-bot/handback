import type { Metadata } from "next";
import Link from "next/link";
import { Marca } from "@/components/marca";
import { Cartao } from "@/components/ui";
import { FormEsqueci } from "./formulario";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function Esqueci() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Marca tamanho="lg" />
        </div>
        <Cartao className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold">Esqueci minha senha</h1>
          <p className="text-sm text-suave">Mandamos um link para você criar uma senha nova. O código das 2 etapas continua sendo pedido.</p>
          <FormEsqueci />
        </Cartao>
        <Link href="/entrar" className="text-center text-sm font-medium text-marca-forte hover:underline">
          ← Voltar para entrar
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";
import { Marca } from "@/components/marca";

export default function NaoEncontrado() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <Marca tamanho="lg" />
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="max-w-sm text-suave">O endereço não existe ou você não tem acesso a ele.</p>
      <Link href="/app" className="font-medium text-marca hover:underline">
        Voltar para minhas empresas
      </Link>
    </main>
  );
}

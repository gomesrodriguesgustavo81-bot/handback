import type { ReactNode } from "react";
import { Marca } from "./marca";
import { Cartao } from "./ui";

/** Moldura das telas de acesso (entrar, criar senha, código). */
export function TelaSimples({ titulo, children, rodape }: { titulo: string; children: ReactNode; rodape?: ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center">
          <Marca tamanho="lg" />
        </div>
        <Cartao className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold">{titulo}</h1>
          {children}
        </Cartao>
        {rodape ? <div className="text-center text-sm text-suave">{rodape}</div> : null}
      </div>
    </main>
  );
}

"use client";

import { Botao } from "./ui";
import { BotaoCopiar } from "./analise";

/** Botões do relatório: imprimir (ou salvar em PDF) e copiar o texto. */
export function AcoesRelatorio({ texto }: { texto: string }) {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Botao type="button" onClick={() => window.print()}>
        Imprimir ou salvar PDF
      </Botao>
      <BotaoCopiarRelatorio texto={texto} />
    </div>
  );
}

function BotaoCopiarRelatorio({ texto }: { texto: string }) {
  return <BotaoCopiar texto={texto} rotulo="Copiar relatório" />;
}

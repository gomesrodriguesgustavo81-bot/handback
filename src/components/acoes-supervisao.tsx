"use client";

import { Botao } from "./ui";
import { useConfirmar } from "./confirmar";

/** Baixar a planilha ou imprimir (PDF): o arquivo tem nomes de alunos, por isso pergunta antes. */
export function AcoesSupervisao({ href }: { href: string }) {
  const { pedir, janela } = useConfirmar();
  const pergunta = {
    titulo: "Baixar o registro?",
    texto: "O arquivo traz os nomes dos alunos e os conceitos. O download fica no registro de atividades.",
    sim: "Sim, baixar",
  };
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Botao
        type="button"
        onClick={async () => {
          if (await pedir(pergunta)) window.location.href = href;
        }}
      >
        Baixar em planilha
      </Botao>
      <Botao
        type="button"
        variante="secundario"
        onClick={async () => {
          if (await pedir({ ...pergunta, titulo: "Imprimir ou salvar em PDF?" })) window.print();
        }}
      >
        Imprimir ou salvar PDF
      </Botao>
      {janela}
    </div>
  );
}

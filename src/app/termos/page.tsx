import type { Metadata } from "next";
import Link from "next/link";
import { Marca } from "@/components/marca";
import { contato, Rodape } from "@/components/rodape";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Regras de uso do Handback.",
};

export default function Termos() {
  const email = contato();
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Marca />
        <Link href="/" className="text-sm font-medium text-marca-forte hover:underline">
          Início
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-16 pt-6 leading-relaxed sm:px-6 [&_h2]:text-xl [&_h2]:font-semibold">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Termos de uso</h1>
          <p className="text-sm text-suave">Atualizados em 22 de novembro de 2026</p>
        </div>
        <h2>1. O serviço</h2>
        <p>
          O Handback ajuda empresas, escolas e escritórios a receber entregas, conferir com inteligência artificial o que foi
          pedido e devolver uma avaliação revisada por uma pessoa. O acesso é dado pela empresa contratante a quem ela
          cadastrar.
        </p>
        <h2>2. Responsabilidades de quem usa</h2>
        <p>
          Quem avalia é responsável por revisar e aprovar cada conceito e devolutiva antes do envio. A análise da
          inteligência artificial é uma sugestão e pode conter erros. Use o Handback só com conteúdo que você tem o direito
          de tratar e respeite a privacidade de quem entrega.
        </p>
        <h2>3. Conta do Gmail</h2>
        <p>
          Ao conectar seu Gmail, você autoriza o Handback a enviar, em seu nome, as devolutivas que você aprovar. Você pode
          desconectar a qualquer momento. Veja os detalhes na{" "}
          <Link href="/privacidade#google" className="font-medium text-marca-forte underline">
            política de privacidade
          </Link>
          .
        </p>
        <h2>4. Uso proibido</h2>
        <p>
          Não é permitido usar o Handback para enviar spam, conteúdo ilegal ou ofensivo, nem tentar acessar dados de outras
          empresas.
        </p>
        <h2>5. Disponibilidade e mudanças</h2>
        <p>
          Trabalhamos para manter o Handback disponível e seguro, mas ele pode passar por manutenções. Podemos atualizar
          estes termos; a data no topo mostra a versão em vigor.
        </p>
        <h2>6. Contato</h2>
        <p>
          Dúvidas sobre estes termos:{" "}
          {email ? (
            <a href={`mailto:${email}`} className="font-medium text-marca-forte underline">
              {email}
            </a>
          ) : (
            "o e-mail de suporte do Handback"
          )}
          .
        </p>
      </main>
      <Rodape />
    </div>
  );
}

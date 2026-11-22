import type { Metadata } from "next";
import { PaginaDeVendas } from "@/components/pagina-de-vendas";
import { TEXTOS } from "@/lib/vendas";

export const metadata: Metadata = {
  title: { absolute: TEXTOS.en.meta.titulo },
  description: TEXTOS.en.meta.descricao,
  alternates: { languages: { "pt-BR": "/", en: "/en", es: "/es" } },
};

export default function Home() {
  return <PaginaDeVendas idioma="en" />;
}

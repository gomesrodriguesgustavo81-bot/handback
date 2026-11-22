import type { Metadata } from "next";
import { PaginaDeVendas } from "@/components/pagina-de-vendas";
import { TEXTOS } from "@/lib/vendas";

export const metadata: Metadata = {
  title: { absolute: TEXTOS.pt.meta.titulo },
  description: TEXTOS.pt.meta.descricao,
  alternates: { languages: { "pt-BR": "/", en: "/en", es: "/es" } },
};

export default function Inicio() {
  return <PaginaDeVendas idioma="pt" />;
}

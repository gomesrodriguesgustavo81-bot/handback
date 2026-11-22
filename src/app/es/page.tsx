import type { Metadata } from "next";
import { PaginaDeVendas } from "@/components/pagina-de-vendas";
import { TEXTOS } from "@/lib/vendas";

export const metadata: Metadata = {
  title: { absolute: TEXTOS.es.meta.titulo },
  description: TEXTOS.es.meta.descricao,
  alternates: { languages: { "pt-BR": "/", en: "/en", es: "/es" } },
};

export default function Inicio() {
  return <PaginaDeVendas idioma="es" />;
}

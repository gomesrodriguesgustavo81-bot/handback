import type { Metadata } from "next";
import { Fechar } from "./fechar";

export const metadata: Metadata = { title: "Gmail", robots: { index: false } };

/** Fim da janelinha do Google: avisa a tela do Handback e fecha sozinha. */
export default async function GmailPronto({ searchParams }: PageProps<"/gmail-pronto">) {
  const { gmail } = await searchParams;
  return <Fechar aviso={typeof gmail === "string" ? gmail : "erro"} />;
}

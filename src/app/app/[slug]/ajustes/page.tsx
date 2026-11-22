import { redirect } from "next/navigation";

/** A antiga página de Ajustes virou as Configurações (cada item numa tela própria). */
export default async function Ajustes({ params }: PageProps<"/app/[slug]/ajustes">) {
  const { slug } = await params;
  redirect(`/app/${slug}/configuracoes`);
}

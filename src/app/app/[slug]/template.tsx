/** A cada troca de tela, o conteúdo entra suave (sem piscar). */
export default function Transicao({ children }: { children: React.ReactNode }) {
  return <div className="entra flex flex-col gap-4">{children}</div>;
}

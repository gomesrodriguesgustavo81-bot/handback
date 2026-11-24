import Link from "next/link";
import { LinkBotao } from "./ui";

/**
 * Nas páginas de uma turma: qual conta esta função usa. Conectar e
 * desconectar ficam só em Contas conectadas (aqui é só o aviso e o atalho).
 */
export function ContaNecessaria({
  slug,
  nome,
  conta,
}: {
  slug: string;
  /** Ex.: "Google Drive". */
  nome: string;
  /** E-mail da conta conectada; "expirou" ou null quando falta conectar. */
  conta: string | "expirou" | null;
}) {
  const href = `/app/${slug}/contas`;
  if (conta && conta !== "expirou") {
    return (
      <p className="text-[13px] text-suave">
        Usa o {nome} de <strong className="break-all text-texto">{conta}</strong> ·{" "}
        <Link href={href} className="font-medium text-marca-forte underline">
          Contas conectadas
        </Link>
      </p>
    );
  }
  return (
    <div role="status" className="flex flex-col gap-2 rounded-2xl border border-alerta/30 bg-alerta-fundo px-4 py-3 text-sm text-alerta">
      <span>
        {conta === "expirou" ? `A conexão com o ${nome} expirou.` : `Para usar isto, conecte o seu ${nome}.`} As contas ficam em Contas conectadas.
      </span>
      <LinkBotao href={href} className="self-start text-sm">
        Ir para Contas conectadas
      </LinkBotao>
    </div>
  );
}

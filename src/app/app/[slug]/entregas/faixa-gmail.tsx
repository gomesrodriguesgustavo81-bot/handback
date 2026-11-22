import { BotaoConfirmar } from "@/components/form-acao";
import { desconectarGmail } from "./acoes";

/** Faixa com o Gmail usado para enviar as devolutivas (ou o convite para conectar). */
export function FaixaGmail({
  slug,
  email,
  invalida,
  conectarHref,
  pendentes,
}: {
  slug: string;
  email: string | null;
  invalida: boolean;
  conectarHref: string;
  pendentes: number;
}) {
  if (email) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-suave">
        <span className="break-all">
          Devolutivas saem do seu Gmail: <strong className="text-texto">{email}</strong>
        </span>
        <BotaoConfirmar acao={desconectarGmail.bind(null, slug)} pergunta="Desconectar seu Gmail do Handback?">
          Desconectar
        </BotaoConfirmar>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-marca/30 bg-marca-clara p-4 sm:max-w-2xl sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-texto">
        {invalida ? "A conexão com o seu Gmail expirou. " : ""}
        <strong>Conecte seu Gmail</strong> para enviar as devolutivas aprovadas
        {pendentes ? ` (${pendentes} esperando)` : ""}. O Handback só envia; não lê sua caixa.
      </p>
      <a
        href={conectarHref}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-marca px-4 font-medium text-sobre-marca hover:bg-marca-forte"
      >
        Conectar meu Gmail
      </a>
    </div>
  );
}

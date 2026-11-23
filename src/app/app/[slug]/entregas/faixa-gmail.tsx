import { ConectarGmail } from "@/components/conectar-gmail";

/** Faixa com o Gmail usado para enviar as devolutivas (ou o convite para conectar). */
export function FaixaGmail({
  email,
  invalida,
  conectarHref,
  pendentes,
}: {
  slug?: string;
  email: string | null;
  invalida: boolean;
  conectarHref: string;
  pendentes: number;
}) {
  // Conectado: nada aqui (ver e desconectar fica em Configurações › E-mail).
  if (email) return null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-marca/30 bg-marca-clara p-4 sm:max-w-2xl sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-texto">
        {invalida ? "A conexão com o seu Gmail expirou. " : ""}
        <strong>Conecte seu Gmail</strong> para enviar as devolutivas aprovadas
        {pendentes ? ` (${pendentes} esperando)` : ""}. O Handback só envia; não lê sua caixa.
      </p>
      <ConectarGmail voltar={new URLSearchParams(conectarHref.split("?")[1] ?? "").get("voltar") ?? "/app"} texto="Conectar meu Gmail" destaque={false} />
    </div>
  );
}

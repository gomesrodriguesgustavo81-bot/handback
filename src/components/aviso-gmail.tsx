import { Aviso } from "./ui";

/** Mensagem depois de voltar da tela de permissão do Google (?gmail=...). */
const AVISOS: Record<string, { tipo: "info" | "erro"; texto: string }> = {
  conectado: { tipo: "info", texto: "Gmail conectado. Agora você pode enviar as devolutivas aprovadas." },
  cancelado: { tipo: "erro", texto: "A conexão com o Gmail foi cancelada." },
  "sem-permissao": { tipo: "erro", texto: "O Google não deu a permissão de enviar e-mails. Conecte de novo e marque essa opção." },
  expirou: { tipo: "erro", texto: "A conexão demorou demais. Tente conectar o Gmail de novo." },
  "nao-configurado": { tipo: "erro", texto: "O envio pelo Gmail ainda não foi configurado no servidor." },
  erro: { tipo: "erro", texto: "Não foi possível conectar o Gmail. Tente de novo." },
};

export function AvisoGmail({ aviso }: { aviso: string | string[] | undefined }) {
  const a = typeof aviso === "string" ? AVISOS[aviso] : undefined;
  return a ? <Aviso tipo={a.tipo}>{a.texto}</Aviso> : null;
}

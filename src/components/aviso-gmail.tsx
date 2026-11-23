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

const NOME = { agenda: "Google Agenda", drive: "Google Drive" } as const;
function avisoDe(servico: keyof typeof NOME, aviso: string) {
  const n = NOME[servico];
  const t: Record<string, { tipo: "info" | "erro"; texto: string }> = {
    conectado: { tipo: "info", texto: `${n} conectado.` },
    cancelado: { tipo: "erro", texto: `A conexão com o ${n} foi cancelada.` },
    "sem-permissao": { tipo: "erro", texto: `O Google não deu a permissão do ${n}. Conecte de novo e marque a opção pedida.` },
    expirou: { tipo: "erro", texto: `A conexão demorou demais. Tente conectar o ${n} de novo.` },
    "nao-configurado": { tipo: "erro", texto: "A conexão com o Google ainda não foi configurada no servidor." },
    erro: { tipo: "erro", texto: `Não foi possível conectar o ${n}. Tente de novo.` },
  };
  return t[aviso];
}

export function AvisoGmail({ aviso, servico = "gmail" }: { aviso: string | string[] | undefined; servico?: "gmail" | keyof typeof NOME }) {
  const a = typeof aviso !== "string" ? undefined : servico === "gmail" ? AVISOS[aviso] : avisoDe(servico, aviso);
  return a ? <Aviso tipo={a.tipo}>{a.texto}</Aviso> : null;
}

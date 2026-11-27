import "server-only";

/**
 * Avisos de segurança por e-mail para a própria pessoa (senha trocada, duas etapas
 * mexida, entrada travada). Saem pelo Resend, de um endereço do domínio do Handback
 * (variável HANDBACK_EMAIL_DE, ex.: "Handback <seguranca@handback.com.br>"). Sem a chave ou
 * sem o endereço, não envia e só registra no log: nunca atrapalha o que a pessoa estava fazendo.
 */
export type EventoDeSeguranca = "senha-trocada" | "duas-etapas-trocada" | "duas-etapas-removida" | "entrada-travada" | "codigos-gerados";

const TEXTOS: Record<EventoDeSeguranca, { assunto: string; titulo: string; texto: string }> = {
  "senha-trocada": {
    assunto: "Sua senha do Handback foi trocada",
    titulo: "Sua senha foi trocada",
    texto: "A senha da sua conta no Handback acabou de ser trocada. Todos os outros aparelhos foram desconectados.",
  },
  "duas-etapas-trocada": {
    assunto: "O celular da verificação em duas etapas mudou",
    titulo: "Você cadastrou um celular novo",
    texto: "O celular da verificação em duas etapas da sua conta no Handback foi trocado.",
  },
  "duas-etapas-removida": {
    assunto: "A verificação em duas etapas foi desligada com um código de recuperação",
    titulo: "Um código de recuperação foi usado",
    texto: "Um código de recuperação foi usado para desligar a verificação em duas etapas da sua conta no Handback. Quem entrou precisou da sua senha e de um código guardado.",
  },
  "entrada-travada": {
    assunto: "Muitas tentativas de entrar na sua conta do Handback",
    titulo: "A entrada da sua conta foi travada por alguns minutos",
    texto: "Alguém errou a senha da sua conta várias vezes seguidas. Por segurança, a entrada ficou travada por alguns minutos.",
  },
  "codigos-gerados": {
    assunto: "Novos códigos de recuperação do Handback",
    titulo: "Você gerou códigos de recuperação novos",
    texto: "Os códigos de recuperação antigos da sua conta no Handback deixaram de valer e foram substituídos por novos.",
  },
};

const SE_NAO_FOI_VOCE = "Se não foi você, troque a senha agora em Minha conta e saia de todos os aparelhos. Em caso de dúvida, responda este e-mail.";

export function montarAvisoDeSeguranca(evento: EventoDeSeguranca, quando = new Date()) {
  const t = TEXTOS[evento];
  const hora = quando.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const texto = `${t.titulo}\n\n${t.texto}\nQuando: ${hora} (horário de Brasília)\n\n${SE_NAO_FOI_VOCE}\n\nHandback`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px"><h2 style="margin:0 0 12px">${t.titulo}</h2><p>${t.texto}</p><p style="color:#5a6478">Quando: ${hora} (horário de Brasília)</p><p>${SE_NAO_FOI_VOCE}</p><p style="color:#5a6478">Handback</p></div>`;
  return { assunto: t.assunto, texto, html };
}

export async function avisarSeguranca(para: string, evento: EventoDeSeguranca): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY;
  const de = process.env.HANDBACK_EMAIL_DE;
  if (!chave || !de || !para) {
    console.warn(`[seguranca] aviso "${evento}" não enviado: falta RESEND_API_KEY ou HANDBACK_EMAIL_DE.`);
    return false;
  }
  const base = (process.env.RESEND_API_BASE ?? "https://api.resend.com").replace(/\/$/, "");
  const m = montarAvisoDeSeguranca(evento);
  try {
    const r = await fetch(`${base}/emails`, {
      method: "POST",
      headers: { authorization: `Bearer ${chave}`, "content-type": "application/json" },
      body: JSON.stringify({ from: de, to: [para], subject: m.assunto, text: m.texto, html: m.html }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch (e) {
    console.error("[seguranca]", e instanceof Error ? e.message : e);
    return false;
  }
}

import "server-only";

/**
 * Avisos de segurança por e-mail para a própria pessoa (senha trocada, duas etapas
 * mexida, entrada travada). Saem pelo Resend, de um endereço do domínio do Handback
 * (variável HANDBACK_EMAIL_DE, ex.: "Handback <seguranca@handback.com.br>"). Sem a chave ou
 * sem o endereço, não envia e só registra no log: nunca atrapalha o que a pessoa estava fazendo.
 */
export type EventoDeSeguranca = "senha-trocada" | "duas-etapas-trocada" | "duas-etapas-removida" | "entrada-travada" | "codigos-gerados";

const TEXTOS: Record<EventoDeSeguranca, { assunto: string; titulo: string; texto: string; oQue: string }> = {
  "senha-trocada": {
    assunto: "Sua senha do Handback foi trocada",
    titulo: "Sua senha foi trocada",
    texto: "A senha da sua conta no Handback acabou de ser trocada. Os outros aparelhos conectados foram desconectados.",
    oQue: "Senha trocada",
  },
  "duas-etapas-trocada": {
    assunto: "O celular da verificação em duas etapas mudou",
    titulo: "Você cadastrou um celular novo",
    texto: "O celular da verificação em duas etapas da sua conta no Handback foi trocado.",
    oQue: "Celular das duas etapas trocado",
  },
  "duas-etapas-removida": {
    assunto: "A verificação em duas etapas foi desligada com um código de recuperação",
    titulo: "Um código de recuperação foi usado",
    texto: "Um código de recuperação foi usado para desligar a verificação em duas etapas da sua conta no Handback. Quem entrou precisou da sua senha e de um código guardado.",
    oQue: "Duas etapas desligadas com código de recuperação",
  },
  "entrada-travada": {
    assunto: "Muitas tentativas de entrar na sua conta do Handback",
    titulo: "A entrada da sua conta foi travada por alguns minutos",
    texto: "Alguém errou a senha da sua conta várias vezes seguidas. Por segurança, a entrada ficou travada por alguns minutos.",
    oQue: "Entrada travada por muitas tentativas",
  },
  "codigos-gerados": {
    assunto: "Novos códigos de recuperação do Handback",
    titulo: "Você gerou códigos de recuperação novos",
    texto: "Os códigos de recuperação antigos da sua conta no Handback deixaram de valer e foram substituídos por novos.",
    oQue: "Códigos de recuperação novos",
  },
};

const SE_NAO_FOI_VOCE = "Se não foi você, troque a senha agora em Minha conta e saia de todos os aparelhos. Se a verificação em duas etapas estiver ativa, ela continua protegendo a conta.";
const FONTE = "Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Este endereço só envia: ninguém lê as respostas. Se houver um contato configurado, aponta para ele. */
function avisoSemResposta(contato = process.env.HANDBACK_CONTATO?.trim() ?? ""): string {
  return contato
    ? `Este e-mail é automático e não recebe respostas. Em caso de dúvida, escreva para ${contato}.`
    : "Este e-mail é automático e não recebe respostas.";
}

const escapar = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type OpcoesDoAviso = { quando?: Date; contato?: string; conta?: string; site?: string };

/** Monta o e-mail (texto e HTML, na cara do Handback) do aviso de segurança. */
export function montarAvisoDeSeguranca(evento: EventoDeSeguranca, opcoes: OpcoesDoAviso | Date = {}) {
  const o: OpcoesDoAviso = opcoes instanceof Date ? { quando: opcoes } : opcoes;
  const t = TEXTOS[evento];
  const semResposta = avisoSemResposta(o.contato);
  const site = (o.site ?? process.env.HANDBACK_SITE ?? "https://www.handback.com.br").replace(/\/$/, "");
  const hora = (o.quando ?? new Date()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const quando = `${hora} (horário de Brasília)`;
  const texto = `${t.titulo}\n\n${t.texto}\n\nO que aconteceu: ${t.oQue}${o.conta ? `\nConta: ${o.conta}` : ""}\nQuando: ${quando}\n\n${SE_NAO_FOI_VOCE}\nProteger a conta: ${site}/conta\n\n${semResposta}\n\nHandback`;
  const linha = (rotulo: string, valor: string, ultima = false) =>
    `<tr><td style="padding:12px 16px;font-family:${FONTE};font-size:13px;color:#5a6478;width:34%;${ultima ? "" : "border-bottom:1px solid #e1e6f0;"}">${rotulo}</td><td style="padding:12px 16px;font-family:${FONTE};font-size:14px;font-weight:600;color:#0f1a33;${ultima ? "" : "border-bottom:1px solid #e1e6f0;"}">${escapar(valor)}</td></tr>`;
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapar(t.titulo)}</title></head>
<body style="margin:0;padding:0;background:#f5f7fb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:552px;background:#ffffff;border:1px solid #e1e6f0;border-radius:20px;overflow:hidden;">
<tr><td style="height:6px;line-height:6px;font-size:0;background:#2f5bea;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 0;"><img src="${site}/email/handback.png" width="132" height="32" alt="handback" style="display:block;border:0;height:32px;width:132px;"></td></tr>
<tr><td style="padding:20px 32px 0;">
<span style="display:inline-block;border-radius:999px;background:#fff1e0;color:#7a4a00;font-family:${FONTE};font-size:12px;font-weight:700;padding:5px 12px;">Segurança da conta</span>
<h1 style="margin:14px 0 12px;font-family:${FONTE};font-size:26px;line-height:1.25;font-weight:800;color:#0f1a33;">${escapar(t.titulo)}</h1>
<p style="margin:0 0 20px;font-family:${FONTE};font-size:16px;line-height:1.6;color:#33405a;">${escapar(t.texto)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e1e6f0;border-radius:14px;border-collapse:separate;">${linha("O que aconteceu", t.oQue)}${o.conta ? linha("Conta", o.conta) : ""}${linha("Quando", quando, true)}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:#fff1e0;border-radius:14px;"><tr><td style="padding:14px 16px;"><p style="margin:0 0 6px;font-family:${FONTE};font-size:14px;font-weight:700;color:#7a4a00;">Não foi você?</p><p style="margin:0;font-family:${FONTE};font-size:14px;line-height:1.55;color:#5a3a00;">${escapar(SE_NAO_FOI_VOCE)}</p></td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr><td align="center" style="background:#2f5bea;border-radius:12px;"><a href="${site}/conta" style="display:block;padding:15px 22px;font-family:${FONTE};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;">Proteger minha conta</a></td></tr></table>
<p style="margin:16px 0 0;font-family:${FONTE};font-size:13px;line-height:1.5;color:#5a6478;">Foi você mesmo? Então não precisa fazer nada.</p>
</td></tr>
<tr><td style="padding:24px 32px 28px;"><p style="margin:0;padding-top:14px;border-top:1px solid #e1e6f0;font-family:${FONTE};font-size:12px;line-height:1.6;color:#5a6478;"><strong style="color:#0f1a33;">Handback</strong> · Você recebe, a IA prepara o rascunho, você decide.<br>${escapar(semResposta)}<br><a href="${site}/privacidade" style="color:#1e40c0;">Política de privacidade</a> · <a href="${site}/termos" style="color:#1e40c0;">Termos de uso</a></p></td></tr>
</table></td></tr></table>
</body></html>`;
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
  const m = montarAvisoDeSeguranca(evento, { conta: para });
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

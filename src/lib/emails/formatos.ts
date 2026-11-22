/**
 * Converte o que o serviço de recebimento de e-mails manda para um formato
 * único do Handback. Assim, trocar de serviço é só acrescentar um formato.
 *
 * Formatos aceitos:
 *  - "postmark" (JSON com From, FromFull, ToFull, Subject, TextBody, HtmlBody,
 *    Headers, Attachments[].Content em base64) — usado por vários serviços.
 *  - "handback" (JSON simples: de, de_nome, para, assunto, texto, html, data,
 *    message_id, responde_a, anexos[].conteudo_base64) — para testes e para
 *    serviços que permitem montar o JSON.
 */

export type AnexoRecebido = { nome: string; tipo: string; conteudo: Buffer; embutido: boolean };

export type EmailRecebido = {
  destinatarios: string[];
  deEmail: string;
  deNome: string;
  assunto: string;
  texto: string;
  html: string;
  enviadoEm: Date;
  messageId: string;
  respondeA: string[];
  anexos: AnexoRecebido[];
};

type Json = Record<string, unknown>;

const texto = (v: unknown) => (typeof v === "string" ? v : "");
const lista = (v: unknown) => (Array.isArray(v) ? v : []);

function enderecos(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap((x) => enderecos(typeof x === "object" && x ? (x as Json).Email ?? (x as Json).email : x));
  return (texto(v).match(/[^\s<>"',;]+@[^\s<>"',;]+/g) ?? []).map((e) => e.toLowerCase());
}

function ids(v: string): string[] {
  return v.match(/<[^<>\s]+>/g) ?? [];
}

function data(v: unknown): Date {
  const d = new Date(texto(v));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Texto a partir do HTML, quando o e-mail não traz a versão em texto. */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function dePostmark(j: Json): EmailRecebido {
  const cabecalhos = new Map<string, string>();
  for (const h of lista(j.Headers)) {
    const hh = h as Json;
    cabecalhos.set(texto(hh.Name).toLowerCase(), texto(hh.Value));
  }
  const de = (j.FromFull as Json | undefined) ?? {};
  const html = texto(j.HtmlBody);
  return {
    destinatarios: [
      ...enderecos(j.ToFull ?? j.To),
      ...enderecos(j.CcFull ?? j.Cc),
      ...enderecos(j.BccFull ?? j.Bcc),
      ...enderecos(j.OriginalRecipient),
      ...enderecos(cabecalhos.get("x-forwarded-to")),
      ...enderecos(cabecalhos.get("delivered-to")),
    ],
    deEmail: (texto(de.Email) || enderecos(j.From)[0] || "").toLowerCase(),
    deNome: texto(de.Name) || texto(j.FromName),
    assunto: texto(j.Subject),
    texto: texto(j.TextBody) || texto(j.StrippedTextReply) || htmlParaTexto(html),
    html,
    enviadoEm: data(j.Date),
    messageId: cabecalhos.get("message-id") || texto(j.MessageID),
    respondeA: [...new Set([...ids(cabecalhos.get("in-reply-to") ?? ""), ...ids(cabecalhos.get("references") ?? "")])],
    anexos: lista(j.Attachments).map((a) => {
      const aa = a as Json;
      return {
        nome: texto(aa.Name) || "anexo",
        tipo: texto(aa.ContentType),
        conteudo: Buffer.from(texto(aa.Content), "base64"),
        embutido: Boolean(texto(aa.ContentID)),
      };
    }),
  };
}

function deHandback(j: Json): EmailRecebido {
  const html = texto(j.html);
  return {
    destinatarios: enderecos(j.para),
    deEmail: (enderecos(j.de)[0] ?? "").toLowerCase(),
    deNome: texto(j.de_nome),
    assunto: texto(j.assunto),
    texto: texto(j.texto) || htmlParaTexto(html),
    html,
    enviadoEm: data(j.data),
    messageId: texto(j.message_id),
    respondeA: lista(j.responde_a).map(texto).filter(Boolean),
    anexos: lista(j.anexos).map((a) => {
      const aa = a as Json;
      return {
        nome: texto(aa.nome) || "anexo",
        tipo: texto(aa.tipo),
        conteudo: Buffer.from(texto(aa.conteudo_base64), "base64"),
        embutido: Boolean(aa.embutido),
      };
    }),
  };
}

export function lerEmailRecebido(corpo: unknown): EmailRecebido | null {
  if (!corpo || typeof corpo !== "object") return null;
  const j = corpo as Json;
  if ("Subject" in j || "FromFull" in j || "TextBody" in j) return dePostmark(j);
  if ("assunto" in j || "de" in j) return deHandback(j);
  return null;
}

/** Acha o código da caixa de entrada nos destinatários: "algo+CODIGO@…" ou "CODIGO@…". */
export function codigosDaCaixa(destinatarios: string[]): string[] {
  const achados = new Set<string>();
  for (const d of destinatarios) {
    const local = d.split("@")[0] ?? "";
    for (const parte of local.split(/[+.\-_]/)) if (/^[a-z0-9]{12}$/.test(parte)) achados.add(parte);
  }
  return [...achados];
}

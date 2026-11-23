/**
 * Recebimento pelo Resend (endereço "…@<código>.resend.app", sem domínio próprio).
 *
 * O Resend chama o Handback com o evento "email.received", que traz só um
 * resumo (id, remetente, destinatários, assunto, lista de anexos). O texto, os
 * cabeçalhos e os arquivos são buscados na API do Resend com RESEND_API_KEY.
 * A chamada é assinada (padrão Svix) com RESEND_WEBHOOK_SECRET ("whsec_…").
 *
 * A leitura aceita pequenas variações de nomes de campos, para não quebrar
 * se o Resend mudar algum detalhe.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { htmlParaTexto, type AnexoRecebido, type EmailRecebido } from "./formatos";

type Json = Record<string, unknown>;
const texto = (v: unknown) => (typeof v === "string" ? v : "");
const lista = (v: unknown) => (Array.isArray(v) ? v : []);

const LIMITE_ANEXOS = 30 * 1024 * 1024;
const TOLERANCIA_S = 5 * 60;

/** Confere a assinatura Svix: "v1,<base64 HMAC-SHA256 de id.timestamp.corpo>". */
export function assinaturaValida(
  segredo: string,
  cab: { id: string | null; timestamp: string | null; assinatura: string | null },
  corpo: string,
  agoraS = Math.floor(Date.now() / 1000),
): boolean {
  if (!segredo || !cab.id || !cab.timestamp || !cab.assinatura) return false;
  const ts = Number(cab.timestamp);
  if (!Number.isFinite(ts) || Math.abs(agoraS - ts) > TOLERANCIA_S) return false;
  const chave = Buffer.from(segredo.replace(/^whsec_/, ""), "base64");
  const esperada = createHmac("sha256", chave).update(`${cab.id}.${cab.timestamp}.${corpo}`).digest();
  return cab.assinatura.split(" ").some((parte) => {
    const [versao, valor] = parte.split(",");
    if (versao !== "v1" || !valor) return false;
    const recebida = Buffer.from(valor, "base64");
    return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
  });
}

function enderecos(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap((x) => enderecos(typeof x === "object" && x ? ((x as Json).email ?? (x as Json).address) : x));
  return (texto(v).match(/[^\s<>"',;]+@[^\s<>"',;]+/g) ?? []).map((e) => e.toLowerCase());
}

function nomeDe(v: unknown): string {
  if (typeof v === "object" && v) return texto((v as Json).name);
  const m = texto(v).match(/^\s*"?([^"<]*?)"?\s*</);
  return m?.[1]?.trim() ?? "";
}

/** Cabeçalhos podem vir como objeto { nome: valor } ou lista [{ name, value }]. */
function cabecalhos(v: unknown): Map<string, string> {
  const m = new Map<string, string>();
  if (Array.isArray(v)) {
    for (const h of v) {
      const hh = h as Json;
      m.set(texto(hh.name ?? hh.Name).toLowerCase(), texto(hh.value ?? hh.Value));
    }
  } else if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Json)) m.set(k.toLowerCase(), Array.isArray(val) ? val.map(texto).join(" ") : texto(val));
  }
  return m;
}

function ids(v: string): string[] {
  return v.match(/<[^<>\s]+>/g) ?? [];
}

function base(): string {
  return (process.env.RESEND_API_BASE ?? "https://api.resend.com").replace(/\/$/, "");
}

async function api(caminho: string, chave: string): Promise<Json> {
  const r = await fetch(`${base()}${caminho}`, {
    headers: { authorization: `Bearer ${chave}`, accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`Resend ${caminho}: HTTP ${r.status}`);
  return (await r.json()) as Json;
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 160);

/** Tenta de novo uma vez (falhas passageiras de rede). */
async function tentar<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch {
    await new Promise((r) => setTimeout(r, 800));
    return f();
  }
}

async function baixar(url: string, chave: string): Promise<Buffer> {
  // O link de download costuma ser temporário e público; se pedir login, manda a chave.
  let r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (r.status === 401 || r.status === 403) {
    r = await fetch(url, { headers: { authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(30_000) });
  }
  if (!r.ok) throw new Error(`download do anexo: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/** Busca o e-mail completo (texto, cabeçalhos e anexos) a partir do evento "email.received". */
export async function buscarEmailResend(evento: Json, chave: string): Promise<EmailRecebido> {
  const resumo = (evento.data as Json | undefined) ?? {};
  const id = texto(resumo.email_id) || texto(resumo.id);
  if (!id) throw new Error("evento sem id do e-mail");
  const completo = await api(`/emails/receiving/${encodeURIComponent(id)}`, chave);
  const e = { ...resumo, ...((completo.data as Json | undefined) ?? completo) } as Json;
  const cab = cabecalhos(e.headers);

  // Anexos: a lista com links de download; se não vier, usa a lista do e-mail
  // (ou do resumo do evento). Nada some calado: cada falha vira um aviso.
  const problemas: string[] = [];
  let infos = (lista(e.attachments).length ? lista(e.attachments) : lista(resumo.attachments)) as Json[];
  try {
    const r = await tentar(() => api(`/emails/receiving/${encodeURIComponent(id)}/attachments`, chave));
    const l = lista(r.data ?? r.attachments) as Json[];
    if (l.length) infos = l;
  } catch (erro) {
    if (infos.length) problemas.push(`Não deu para listar os anexos no Resend (${mensagem(erro)}).`);
  }
  const anexos: AnexoRecebido[] = [];
  let total = 0;
  for (const a of infos) {
    const nome = texto(a.filename) || texto(a.name) || "anexo";
    try {
      let url = texto(a.download_url) || texto(a.url);
      const conteudoBase64 = texto(a.content);
      if (!url && !conteudoBase64 && texto(a.id)) {
        const det = await tentar(() => api(`/emails/receiving/${encodeURIComponent(id)}/attachments/${encodeURIComponent(texto(a.id))}`, chave));
        const d = (det.data as Json | undefined) ?? det;
        url = texto(d.download_url) || texto(d.url);
        if (!url && texto(d.content)) a.content = d.content;
      }
      const base64 = texto(a.content);
      if (!url && !base64) throw new Error("o Resend não deu o link para baixar");
      const conteudo = base64 ? Buffer.from(base64, "base64") : await tentar(() => baixar(url, chave));
      if (!conteudo.length) throw new Error("arquivo veio vazio");
      total += conteudo.length;
      if (total > LIMITE_ANEXOS) {
        problemas.push(`“${nome}” não foi guardado: os anexos passaram de 30 MB.`);
        break;
      }
      anexos.push({
        nome,
        tipo: texto(a.content_type) || texto(a.contentType),
        conteudo,
        embutido: Boolean(texto(a.content_id)) && /inline/i.test(texto(a.content_disposition) || "inline"),
      });
    } catch (erro) {
      console.error("[emails/resend] anexo", nome, erro);
      problemas.push(`O anexo “${nome}” chegou, mas o Handback não conseguiu baixá-lo (${mensagem(erro)}).`);
    }
  }

  const html = texto(e.html);
  const enviado = new Date(cab.get("date") || texto(e.created_at));
  return {
    destinatarios: [
      ...enderecos(e.to),
      ...enderecos(e.cc),
      ...enderecos(e.bcc),
      ...enderecos(cab.get("delivered-to")),
      ...enderecos(cab.get("x-forwarded-to")),
      ...enderecos(cab.get("x-original-to")),
    ],
    deEmail: enderecos(e.from)[0] ?? "",
    deNome: nomeDe(e.from),
    assunto: texto(e.subject),
    texto: texto(e.text) || htmlParaTexto(html),
    html,
    enviadoEm: Number.isNaN(enviado.getTime()) ? new Date() : enviado,
    messageId: ids(cab.get("message-id") ?? "")[0] ?? (texto(e.message_id) ? `<${texto(e.message_id).replace(/^<|>$/g, "")}>` : `<${id}@resend>`),
    respondeA: [...new Set([...ids(cab.get("in-reply-to") ?? ""), ...ids(cab.get("references") ?? "")])],
    anexos,
    problemasAnexos: problemas,
    idOrigem: `resend:${id}`,
  };
}

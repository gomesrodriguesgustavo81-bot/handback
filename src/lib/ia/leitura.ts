/**
 * Leitura do conteúdo de uma entrega para a IA (como no protótipo):
 * corpo do e-mail, anexos (PDF, imagens, Word, PowerPoint, texto) e links
 * públicos do Google Docs/Slides/Drive.
 */
import { strFromU8, unzipSync } from "fflate";

export const LIMITE_BYTES_ARQUIVOS = 8 * 1024 * 1024; // PDFs + imagens por entrega
const LIMITE_TEXTO = 200_000;
const LIMITE_POR_ARQUIVO = 50_000;

export type ParteIA = { text: string } | { inlineData: { mimeType: string; data: string } };

export type Conteudo = { textos: string[]; partes: ParteIA[]; lidos: string[]; avisos: string[]; bytes: number; chars: number };

export function novoConteudo(): Conteudo {
  return { textos: [], partes: [], lidos: [], avisos: [], bytes: 0, chars: 0 };
}

export function addTexto(c: Conteudo, rotulo: string, texto: string) {
  const t = String(texto ?? "").trim();
  if (!t) return;
  const resto = LIMITE_TEXTO - c.chars;
  if (resto <= 0) {
    c.avisos.push(`Texto de "${rotulo}" não enviado (limite de texto atingido).`);
    return;
  }
  const corte = t.slice(0, Math.min(LIMITE_POR_ARQUIVO, resto));
  if (corte.length < t.length) c.avisos.push(`"${rotulo}" foi cortado por ser muito longo.`);
  c.textos.push(`=== ${rotulo} ===\n${corte}`);
  c.chars += corte.length;
}

function addBinario(c: Conteudo, dados: Uint8Array, mime: string, nome: string) {
  if (c.bytes + dados.length > LIMITE_BYTES_ARQUIVOS) {
    c.avisos.push(`"${nome}" não foi enviado à IA (limite de 8 MB de PDFs e imagens por entrega).`);
    return;
  }
  c.partes.push({ text: `[Arquivo anexado: ${nome}]` });
  c.partes.push({ inlineData: { mimeType: mime, data: Buffer.from(dados).toString("base64") } });
  c.bytes += dados.length;
  c.lidos.push(nome);
}

/** Texto de DOCX/PPTX a partir do XML interno. */
export function textoXmlOffice(xml: string, prefixo: string, fimParagrafo: string): string {
  const re = new RegExp(`<${prefixo}:t(?:\\s[^>]*)?>([\\s\\S]*?)</${prefixo}:t>|</${fimParagrafo}>`, "g");
  const saida: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) saida.push(m[1] !== undefined ? m[1] : "\n");
  return saida
    .join("")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function textoDocx(dados: Uint8Array): string {
  const pkg = unzipSync(dados, { filter: (f) => f.name === "word/document.xml" });
  const doc = pkg["word/document.xml"];
  return doc ? textoXmlOffice(strFromU8(doc), "w", "w:p") : "";
}

export function textoPptx(dados: Uint8Array): string {
  const pkg = unzipSync(dados, { filter: (f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.name) });
  const num = (n: string) => Number(n.match(/(\d+)\.xml$/)?.[1] ?? 0);
  return Object.keys(pkg)
    .sort((a, b) => num(a) - num(b))
    .map((n) => `--- Slide ${num(n)} ---\n${textoXmlOffice(strFromU8(pkg[n]), "a", "a:p")}`)
    .join("\n\n");
}

/** Lê um arquivo e coloca no conteúdo (texto ou binário para a IA). */
export function lerArquivo(c: Conteudo, dados: Uint8Array, nome: string, tipo: string) {
  const ext = (nome.split(".").pop() ?? "").toLowerCase();
  const mime = (tipo ?? "").toLowerCase();
  const imagens: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
  try {
    if (ext === "pdf" || mime === "application/pdf") return addBinario(c, dados, "application/pdf", nome);
    if (imagens[ext]) return addBinario(c, dados, imagens[ext], nome);
    if (/^image\/(png|jpe?g|webp)$/.test(mime)) return addBinario(c, dados, mime.replace("jpg", "jpeg"), nome);
    if (ext === "docx") {
      addTexto(c, `ARQUIVO ${nome}`, textoDocx(dados));
      c.lidos.push(nome);
      return;
    }
    if (ext === "pptx") {
      addTexto(c, `APRESENTAÇÃO ${nome}`, textoPptx(dados));
      c.lidos.push(nome);
      return;
    }
    if (["txt", "csv", "md"].includes(ext) || mime.startsWith("text/")) {
      addTexto(c, `ARQUIVO ${nome}`, strFromU8(dados));
      c.lidos.push(nome);
      return;
    }
  } catch {
    c.avisos.push(`Não foi possível ler "${nome}" (arquivo corrompido ou protegido).`);
    return;
  }
  c.avisos.push(`Formato não lido automaticamente: "${nome}" (peça PDF, imagem, Word, PowerPoint ou link do Google).`);
}

/** Corpo do e-mail sem as citações de mensagens anteriores. */
export function limparCorpo(texto: string): string {
  return String(texto ?? "")
    .split(/\n\s*(Em .+ escreveu:|On .+ wrote:|-{2,} ?Mensagem original)/)[0]
    .split("\n")
    .filter((l) => !/^\s*>/.test(l))
    .join("\n");
}

/** Endereço de exportação em texto de um link público do Google (ou null). */
export function exportacaoGoogle(url: string): { tipo: string; url: string } | null {
  const id = url.match(/\/d\/([-\w]{20,})/)?.[1] ?? url.match(/[?&]id=([-\w]{20,})/)?.[1];
  if (!id) return null;
  if (/docs\.google\.com\/document/.test(url)) return { tipo: "Docs", url: `https://docs.google.com/document/d/${id}/export?format=txt` };
  if (/docs\.google\.com\/presentation/.test(url)) return { tipo: "Slides", url: `https://docs.google.com/presentation/d/${id}/export/txt` };
  if (/docs\.google\.com\/spreadsheets/.test(url)) return { tipo: "Planilha", url: `https://docs.google.com/spreadsheets/d/${id}/export?format=csv` };
  if (/drive\.google\.com/.test(url)) return { tipo: "Drive", url: `https://drive.google.com/uc?export=download&id=${id}` };
  return null;
}

/** Tenta ler um link público do Google. Links privados viram aviso (não são "não entregue"). */
export async function lerLink(c: Conteudo, url: string, baixar: typeof fetch = fetch) {
  const exp = exportacaoGoogle(url);
  if (!exp) {
    c.avisos.push(`Link externo não lido pela IA: ${url} (só o endereço foi considerado).`);
    return;
  }
  try {
    const r = await baixar(exp.url, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
    const tipo = r.headers.get("content-type") ?? "";
    if (!r.ok || /text\/html/.test(tipo)) throw new Error(`HTTP ${r.status}`);
    const dados = new Uint8Array(await r.arrayBuffer());
    if (exp.tipo === "Drive") {
      const nome = r.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? "arquivo-do-drive";
      lerArquivo(c, dados, nome, tipo);
    } else {
      addTexto(c, `GOOGLE ${exp.tipo.toUpperCase()} (${url})`, strFromU8(dados));
      c.lidos.push(`${exp.tipo}: ${url}`);
    }
  } catch {
    c.avisos.push(`Sem acesso ao link ${url} (peça para compartilhar como "qualquer pessoa com o link").`);
  }
}

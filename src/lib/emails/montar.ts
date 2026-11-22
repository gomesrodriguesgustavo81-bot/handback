/**
 * Monta o e-mail da devolutiva no formato que o Gmail aceita (RFC 2822,
 * em base64url). Responde na mesma conversa quando há o Message-ID do
 * e-mail da entrega.
 */

export type DadosEnvio = {
  para: string[];
  copia: string[];
  assunto: string;
  origem: "email" | "manual";
  message_id: string;
  referencias: string[];
  devolutiva: string;
  conceito: string | null;
  enviar_conceito: boolean;
  grupo: string;
  etapa: string;
};

/** Assunto: "Re: <assunto original>" ou um assunto novo para entregas à mão. */
export function assuntoDoEnvio(d: Pick<DadosEnvio, "assunto" | "origem" | "grupo" | "etapa">): string {
  const original = d.assunto.trim();
  if (d.origem === "email" && original) return /^re:/i.test(original) ? original : `Re: ${original}`;
  return `Devolutiva · ${d.etapa} · ${d.grupo}`;
}

/** Texto do e-mail: conceito (se a empresa quiser) + devolutiva. */
export function textoDoEnvio(d: Pick<DadosEnvio, "devolutiva" | "conceito" | "enviar_conceito">): string {
  const conceito = d.enviar_conceito && d.conceito && d.conceito !== "PENDENTE" ? `Conceito: ${d.conceito}\n\n` : "";
  return `${conceito}${d.devolutiva.trim()}\n`;
}

/** Cabeçalho com acentos (RFC 2047). */
export function cabecalhoCodificado(texto: string): string {
  if (/^[\x20-\x7e]*$/.test(texto)) return texto;
  return `=?UTF-8?B?${Buffer.from(texto, "utf8").toString("base64")}?=`;
}

function semQuebra(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

const EMAIL = /^[^@\s<>,;"]+@[^@\s<>,;"]+\.[^@\s<>,;"]+$/;

export function montarMensagem(de: string, d: DadosEnvio): { raw: string; para: string[]; copia: string[]; assunto: string } {
  const para = d.para.map((x) => x.trim().toLowerCase()).filter((x) => EMAIL.test(x));
  const copia = d.copia.map((x) => x.trim().toLowerCase()).filter((x) => EMAIL.test(x) && !para.includes(x));
  if (!para.length) throw new Error("Ninguém para receber: cadastre os e-mails dos integrantes.");
  const assunto = semQuebra(assuntoDoEnvio(d));
  const id = semQuebra(d.message_id);
  const refs = [...d.referencias.map(semQuebra), id].filter((x) => /^<[^<>\s]+>$/.test(x));
  const linhas = [
    `From: ${semQuebra(de)}`,
    `To: ${para.join(", ")}`,
    ...(copia.length ? [`Cc: ${copia.join(", ")}`] : []),
    `Subject: ${cabecalhoCodificado(assunto)}`,
    ...(/^<[^<>\s]+>$/.test(id) ? [`In-Reply-To: ${id}`] : []),
    ...(refs.length ? [`References: ${[...new Set(refs)].join(" ")}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    (Buffer.from(textoDoEnvio(d), "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n"),
  ];
  const raw = Buffer.from(linhas.join("\r\n"), "utf8").toString("base64url");
  return { raw, para, copia, assunto };
}

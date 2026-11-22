/**
 * Monta o e-mail da devolutiva no formato que o Gmail aceita (RFC 2822,
 * em base64url): uma versão bonita (HTML) e uma em texto simples, para
 * quem lê e-mail sem formatação. Responde na mesma conversa quando há o
 * Message-ID do e-mail da entrega.
 */

export type ItemChecklist = { item: string; status: "ENTREGUE" | "PARCIAL" | "NAO_ENTREGUE" };

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
  empresa?: string;
  checklist?: ItemChecklist[];
};

/** Assunto: "Re: <assunto original>" ou um assunto novo para entregas à mão. */
export function assuntoDoEnvio(d: Pick<DadosEnvio, "assunto" | "origem" | "grupo" | "etapa">): string {
  const original = d.assunto.trim();
  if (d.origem === "email" && original) return /^re:/i.test(original) ? original : `Re: ${original}`;
  return `Devolutiva · ${d.etapa} · ${d.grupo}`;
}

function mostraConceito(d: Pick<DadosEnvio, "conceito" | "enviar_conceito">): d is { conceito: string; enviar_conceito: true } {
  return Boolean(d.enviar_conceito && d.conceito && d.conceito !== "PENDENTE");
}

const ROTULO_ITEM = { ENTREGUE: "Entregue", PARCIAL: "Parcial", NAO_ENTREGUE: "Não entregue" } as const;
const SIMBOLO_ITEM = { ENTREGUE: "✅", PARCIAL: "🟡", NAO_ENTREGUE: "❌" } as const;

/** Versão em texto simples: conceito e checklist (se a empresa quiser) + devolutiva. */
export function textoDoEnvio(d: Pick<DadosEnvio, "devolutiva" | "conceito" | "enviar_conceito" | "checklist">): string {
  const partes: string[] = [];
  if (mostraConceito(d)) partes.push(`Conceito: ${d.conceito}`);
  partes.push(d.devolutiva.trim());
  if (d.enviar_conceito && d.checklist?.length) {
    partes.push(["O que foi pedido:", ...d.checklist.map((c) => `${SIMBOLO_ITEM[c.status] ?? "•"} ${c.item} (${ROTULO_ITEM[c.status] ?? c.status})`)].join("\n"));
  }
  return `${partes.join("\n\n")}\n`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const COR_CONCEITO: Record<string, [string, string]> = {
  EXCELENTE: ["#dff3ec", "#0b5e53"],
  BOM: ["#e3edfb", "#1d4f91"],
  REGULAR: ["#fdf0d9", "#8a5300"],
  RUIM: ["#fbe3e1", "#9b2c23"],
};
const COR_ITEM = { ENTREGUE: ["#dcf2e6", "#1f6b45", "✓"], PARCIAL: ["#fdf0d9", "#8a5300", "–"], NAO_ENTREGUE: ["#fbe3e1", "#9b2c23", "✕"] } as const;

/** Versão bonita (HTML em tabelas, que funciona no Gmail, Outlook e celular). */
export function htmlDoEnvio(d: DadosEnvio): string {
  const fonte = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  const paragrafos = d.devolutiva
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 14px;${fonte}font-size:16px;line-height:1.6;color:#15201c;">${esc(p.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const [fundoC, textoC] = COR_CONCEITO[d.conceito ?? ""] ?? ["#eceeed", "#4a5550"];
  const conceito = mostraConceito(d)
    ? `<tr><td style="padding:0 28px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="${fonte}font-size:12px;color:#5b6862;text-transform:uppercase;letter-spacing:0.06em;padding-right:10px;">Conceito</td>
          <td style="background:${fundoC};color:${textoC};${fonte}font-size:14px;font-weight:700;letter-spacing:0.04em;padding:6px 12px;border-radius:8px;">${esc(d.conceito)}</td>
        </tr></table>
      </td></tr>`
    : "";
  const itens =
    d.enviar_conceito && d.checklist?.length
      ? `<tr><td style="padding:4px 28px 8px;">
          <p style="margin:0 0 10px;${fonte}font-size:12px;font-weight:600;color:#5b6862;text-transform:uppercase;letter-spacing:0.06em;">O que foi pedido</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${d.checklist
            .map((c) => {
              const [f, t, s] = COR_ITEM[c.status] ?? COR_ITEM.NAO_ENTREGUE;
              return `<tr>
                <td width="30" valign="top" style="padding:0 0 10px;"><span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:11px;background:${f};color:${t};text-align:center;${fonte}font-size:13px;font-weight:700;">${s}</span></td>
                <td valign="top" style="padding:1px 0 10px;${fonte}font-size:15px;line-height:1.4;color:#15201c;">${esc(c.item)} <span style="color:#5b6862;font-size:13px;">· ${ROTULO_ITEM[c.status] ?? ""}</span></td>
              </tr>`;
            })
            .join("")}</table>
        </td></tr>`
      : "";
  const empresa = d.empresa ? esc(d.empresa) : "";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(d.etapa)}</title></head>
<body style="margin:0;padding:0;background:#f7f8f6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8f6;"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dfe4e1;border-radius:16px;">
    <tr><td style="padding:24px 28px 8px;">
      <p style="margin:0;${fonte}font-size:13px;color:#5b6862;">${empresa ? `${empresa} · ` : ""}${esc(d.etapa)}</p>
      <h1 style="margin:4px 0 0;${fonte}font-size:22px;line-height:1.3;color:#15201c;">Devolutiva para ${esc(d.grupo)}</h1>
    </td></tr>
    <tr><td style="padding:16px 28px 0;"></td></tr>
    ${conceito}
    <tr><td style="padding:0 28px 8px;">${paragrafos}</td></tr>
    ${itens}
    <tr><td style="padding:12px 28px 22px;border-top:1px solid #eef1ef;">
      <p style="margin:0;${fonte}font-size:12px;color:#8a958f;">Enviado pelo <span style="color:#0f7b6c;font-weight:600;">handback</span>${empresa ? ` em nome de ${empresa}` : ""}. Para responder, é só responder este e-mail.</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/** Cabeçalho com acentos (RFC 2047). */
export function cabecalhoCodificado(texto: string): string {
  if (/^[\x20-\x7e]*$/.test(texto)) return texto;
  return `=?UTF-8?B?${Buffer.from(texto, "utf8").toString("base64")}?=`;
}

function semQuebra(s: string): string {
  return s.replace(/[\r\n]+/g, " ").trim();
}

function base64EmLinhas(s: string): string {
  return (Buffer.from(s, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n");
}

const EMAIL = /^[^@\s<>,;"]+@[^@\s<>,;"]+\.[^@\s<>,;"]+$/;

export function montarMensagem(
  de: string,
  d: DadosEnvio,
  fronteira = `hb-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`,
): { raw: string; para: string[]; copia: string[]; assunto: string } {
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
    `Content-Type: multipart/alternative; boundary="${fronteira}"`,
    "",
    `--${fronteira}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64EmLinhas(textoDoEnvio(d)),
    `--${fronteira}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64EmLinhas(htmlDoEnvio(d)),
    `--${fronteira}--`,
    "",
  ];
  const raw = Buffer.from(linhas.join("\r\n"), "utf8").toString("base64url");
  return { raw, para, copia, assunto };
}

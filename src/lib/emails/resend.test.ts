import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assinaturaValida, buscarEmailResend } from "./resend";

const SEGREDO = `whsec_${Buffer.from("segredo-de-teste-123").toString("base64")}`;
function assinar(id: string, ts: string, corpo: string) {
  const chave = Buffer.from(SEGREDO.slice(6), "base64");
  return `v1,${createHmac("sha256", chave).update(`${id}.${ts}.${corpo}`).digest("base64")}`;
}

describe("assinaturaValida", () => {
  const corpo = '{"type":"email.received"}';
  const agora = 1_800_000_000;
  it("aceita a assinatura certa (inclusive entre várias)", () => {
    const sig = assinar("msg_1", String(agora), corpo);
    expect(assinaturaValida(SEGREDO, { id: "msg_1", timestamp: String(agora), assinatura: `v1,errada ${sig}` }, corpo, agora)).toBe(true);
  });
  it("recusa corpo alterado, segredo errado, horário velho ou cabeçalho faltando", () => {
    const sig = assinar("msg_1", String(agora), corpo);
    expect(assinaturaValida(SEGREDO, { id: "msg_1", timestamp: String(agora), assinatura: sig }, corpo + " ", agora)).toBe(false);
    expect(assinaturaValida("whsec_" + Buffer.from("outro").toString("base64"), { id: "msg_1", timestamp: String(agora), assinatura: sig }, corpo, agora)).toBe(false);
    expect(assinaturaValida(SEGREDO, { id: "msg_1", timestamp: String(agora), assinatura: sig }, corpo, agora + 3600)).toBe(false);
    expect(assinaturaValida(SEGREDO, { id: null, timestamp: String(agora), assinatura: sig }, corpo, agora)).toBe(false);
  });
});

describe("buscarEmailResend", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("monta o e-mail com texto, cabeçalhos da conversa e anexos baixados", async () => {
    const respostas: Record<string, unknown> = {
      "https://api.resend.com/emails/receiving/em_1": {
        object: "email",
        id: "em_1",
        from: "Aluna Um <A1@aluno.test>",
        to: ["entregas+abcdefabcdef@xyz.resend.app"],
        subject: "[ENTREGA] Encontro 1 - Azul",
        text: "",
        html: "<p>Segue</p>",
        headers: { "message-id": "<m1@aluno>", "in-reply-to": "<m0@aluno>", date: "Mon, 23 Nov 2026 10:00:00 -0300" },
      },
      "https://api.resend.com/emails/receiving/em_1/attachments": {
        data: [{ id: "at_1", filename: "relatorio.pdf", content_type: "application/pdf", download_url: "https://cdn.resend.test/at_1" }],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "https://cdn.resend.test/at_1") return new Response("conteudo");
        const r = respostas[url];
        return r ? Response.json(r) : new Response("não", { status: 404 });
      }),
    );
    const e = await buscarEmailResend({ type: "email.received", data: { email_id: "em_1" } }, "re_chave");
    expect(e.deEmail).toBe("a1@aluno.test");
    expect(e.deNome).toBe("Aluna Um");
    expect(e.destinatarios).toContain("entregas+abcdefabcdef@xyz.resend.app");
    expect(e.texto).toBe("Segue");
    expect(e.messageId).toBe("<m1@aluno>");
    expect(e.respondeA).toEqual(["<m0@aluno>"]);
    expect(e.enviadoEm.toISOString()).toBe("2026-11-23T13:00:00.000Z");
    expect(e.anexos).toHaveLength(1);
    expect(e.anexos[0].nome).toBe("relatorio.pdf");
    expect(e.anexos[0].conteudo.toString()).toBe("conteudo");
  });
});

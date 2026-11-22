import { describe, expect, it } from "vitest";
import { assuntoDoEnvio, montarMensagem, textoDoEnvio, type DadosEnvio } from "./montar";

const base: DadosEnvio = {
  para: ["Lider@Verde.test"],
  copia: ["ana@verde.test", "lider@verde.test", "não é email"],
  assunto: "[ENTREGA] Encontro 1 - Verde",
  origem: "email",
  message_id: "<orig@aluno>",
  referencias: ["<antes@aluno>"],
  devolutiva: "Pessoal, ótima entrega!",
  conceito: "BOM",
  enviar_conceito: true,
  grupo: "Verde",
  etapa: "Encontro 1 · Diagnóstico",
};

function decodificar(raw: string) {
  const texto = Buffer.from(raw, "base64url").toString("utf8");
  const [cab, corpo] = texto.split("\r\n\r\n");
  return { cab, corpo: Buffer.from(corpo.replace(/\r\n/g, ""), "base64").toString("utf8") };
}

describe("montarMensagem", () => {
  it("responde na mesma conversa, com cópia sem repetir e sem endereços inválidos", () => {
    const m = montarMensagem("prof@gmail.test", base);
    const { cab, corpo } = decodificar(m.raw);
    expect(cab).toContain("To: lider@verde.test");
    expect(cab).toContain("Cc: ana@verde.test\r\n");
    expect(cab).toContain("In-Reply-To: <orig@aluno>");
    expect(cab).toContain("References: <antes@aluno> <orig@aluno>");
    expect(m.assunto).toBe("Re: [ENTREGA] Encontro 1 - Verde");
    expect(corpo).toBe("Conceito: BOM\n\nPessoal, ótima entrega!\n");
  });

  it("não deixa quebra de linha entrar nos cabeçalhos", () => {
    const m = montarMensagem("prof@gmail.test", { ...base, assunto: "Oi\r\nBcc: espiao@x.test" });
    const { cab } = decodificar(m.raw);
    expect(cab).not.toMatch(/^Bcc:/m);
  });

  it("codifica acentos no assunto e cria assunto para entrega registrada à mão", () => {
    const m = montarMensagem("prof@gmail.test", { ...base, origem: "manual", message_id: "", referencias: [] });
    const { cab } = decodificar(m.raw);
    expect(m.assunto).toBe("Devolutiva · Encontro 1 · Diagnóstico · Verde");
    expect(cab).toMatch(/Subject: =\?UTF-8\?B\?/);
    expect(cab).not.toContain("In-Reply-To");
  });

  it("recusa quando não há ninguém para receber", () => {
    expect(() => montarMensagem("p@g.test", { ...base, para: ["sem-arroba"] })).toThrow(/Ninguém para receber/);
  });
});

describe("texto e assunto", () => {
  it("respeita a escolha de não mandar o conceito e não repete Re:", () => {
    expect(textoDoEnvio({ ...base, enviar_conceito: false })).toBe("Pessoal, ótima entrega!\n");
    expect(textoDoEnvio({ ...base, conceito: "PENDENTE" })).toBe("Pessoal, ótima entrega!\n");
    expect(assuntoDoEnvio({ ...base, assunto: "RE: entrega" })).toBe("RE: entrega");
  });
});

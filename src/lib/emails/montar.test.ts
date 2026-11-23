import { describe, expect, it } from "vitest";
import { assuntoDoEnvio, montarMensagem, remetenteComNome, textoDoEnvio, type DadosEnvio } from "./montar";

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
  const cab = texto.split("\r\n\r\n")[0];
  const fronteira = cab.match(/boundary="([^"]+)"/)![1];
  const partes = texto.split(`--${fronteira}`).slice(1, -1).map((p) => {
    const [c, corpo] = p.replace(/^\r\n/, "").split("\r\n\r\n");
    return { tipo: c.match(/Content-Type: ([^;]+)/)![1], conteudo: Buffer.from(corpo.replace(/\r\n/g, ""), "base64").toString("utf8") };
  });
  return { cab, corpo: partes.find((p) => p.tipo === "text/plain")!.conteudo, html: partes.find((p) => p.tipo === "text/html")!.conteudo };
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

  it("manda uma versão bonita (HTML) com conceito, checklist e texto escapado", () => {
    const { html, corpo } = decodificar(
      montarMensagem("prof@gmail.test", {
        ...base,
        empresa: "Escola <Alfa>",
        devolutiva: "Primeiro parágrafo.\n\nSegundo <b>parágrafo</b>.",
        checklist: [
          { item: "Matriz CSD", status: "ENTREGUE" },
          { item: "Pesquisa", status: "PARCIAL" },
        ],
      }).raw,
    );
    expect(html).toContain("Devolutiva para Verde");
    expect(html).toContain("Escola &lt;Alfa&gt; · Encontro 1 · Diagnóstico");
    expect(html).toContain(">BOM</td>");
    expect(html).toContain("Segundo &lt;b&gt;parágrafo&lt;/b&gt;.");
    expect(html).not.toContain("<b>parágrafo");
    expect(html).toContain("Matriz CSD");
    expect(corpo).toContain("O que foi pedido:\n✅ Matriz CSD (Entregue)\n🟡 Pesquisa (Parcial)");
  });

  it("sem conceito na empresa, não manda conceito nem checklist", () => {
    const { html, corpo } = decodificar(
      montarMensagem("p@g.test", { ...base, enviar_conceito: false, checklist: [{ item: "Matriz CSD", status: "ENTREGUE" }] }).raw,
    );
    expect(html).not.toContain(">BOM</td>");
    expect(html).not.toContain("O que foi pedido");
    expect(corpo).toBe("Pessoal, ótima entrega!\n");
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
  it("sai com o nome escolhido e com cópia oculta para quem enviou", () => {
    const de = remetenteComNome("prof@gmail.test", "Prof. Ana, Souza");
    expect(de).toBe(`=?UTF-8?B?${Buffer.from("Prof. Ana, Souza").toString("base64")}?= <prof@gmail.test>`);
    expect(remetenteComNome("prof@gmail.test", "")).toBe("prof@gmail.test");
    const raw = Buffer.from(montarMensagem(de, base, "f", ["Ana@Escola.test"]).raw, "base64url").toString();
    expect(raw).toContain(`From: ${de}`);
    expect(raw).toContain("Bcc: ana@escola.test");
  });
});

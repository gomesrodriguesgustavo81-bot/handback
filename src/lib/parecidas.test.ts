import { describe, expect, it, vi } from "vitest";
import { zlibSync, strToU8 } from "fflate";

vi.mock("server-only", () => ({}));
const { assinaturaDoTexto, semelhanca, textoDoPdf, codigoDoArquivo } = await import("./parecidas");

const base = "A matriz CSD mostra certezas suposições e dúvidas da equipe sobre o problema de mobilidade urbana em São Paulo, com entrevistas de doze usuários e uma análise de concorrentes que usam bicicletas compartilhadas.";

describe("entregas parecidas", () => {
  it("mesmo texto dá 100%, texto quase igual dá alto, texto diferente dá baixo", () => {
    const a = assinaturaDoTexto(base.repeat(3)).assinatura;
    expect(semelhanca(a, assinaturaDoTexto(base.repeat(3)).assinatura)).toBe(1);
    const quase = assinaturaDoTexto((base + " Conclusão: precisamos testar o protótipo.").repeat(3)).assinatura;
    expect(semelhanca(a, quase)).toBeGreaterThan(0.6);
    const outro = assinaturaDoTexto("O relatório apresenta o teste de usabilidade com cinco participantes, medindo tempo de tarefa e erros, e propõe melhorias na navegação do aplicativo de agendamento de consultas médicas.".repeat(3)).assinatura;
    expect(semelhanca(a, outro)).toBeLessThan(0.2);
  });

  it("acentos e maiúsculas não mudam a comparação", () => {
    expect(semelhanca(assinaturaDoTexto(base).assinatura, assinaturaDoTexto(base.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "")).assinatura)).toBe(1);
  });

  it("lê o texto de um PDF simples (comprimido ou não)", () => {
    const conteudo = "BT /F1 12 Tf 72 712 Td (Matriz CSD da equipe) Tj [(Mobilidade) -250 (urbana)] TJ ET";
    const pdfAberto = strToU8(`%PDF-1.4\n1 0 obj << /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream\nendobj\n%%EOF`);
    expect(textoDoPdf(pdfAberto)).toContain("Matriz CSD da equipe");
    const comprimido = zlibSync(strToU8(conteudo));
    const cab = strToU8("%PDF-1.4\n1 0 obj << /Filter /FlateDecode >>\nstream\n");
    const fim = strToU8("\nendstream\nendobj\n%%EOF");
    const pdf = new Uint8Array(cab.length + comprimido.length + fim.length);
    pdf.set(cab, 0);
    pdf.set(comprimido, cab.length);
    pdf.set(fim, cab.length + comprimido.length);
    expect(textoDoPdf(pdf)).toMatch(/Matriz CSD da equipe[\s\S]*Mobilidade/);
  });

  it("o mesmo arquivo tem o mesmo código", () => {
    expect(codigoDoArquivo(strToU8("abc"))).toBe(codigoDoArquivo(strToU8("abc")));
    expect(codigoDoArquivo(strToU8("abc"))).not.toBe(codigoDoArquivo(strToU8("abd")));
  });
});

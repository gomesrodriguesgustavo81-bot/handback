import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { normalizarCodigo, novoCodigo } from "./recuperacao";
import { conferirMarca, marcarSenha } from "./senhas-antigas";
import { montarAvisoDeSeguranca } from "./emails/seguranca";

describe("códigos de recuperação", () => {
  it("gera códigos XXXXX-XXXXX sem letras que se confundem", () => {
    for (let i = 0; i < 50; i++) {
      expect(novoCodigo()).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    }
    expect(new Set(Array.from({ length: 200 }, novoCodigo)).size).toBe(200);
  });
  it("aceita minúsculas, espaços e sem o traço", () => {
    expect(normalizarCodigo("abcde fghjk")).toBe("ABCDE-FGHJK");
    expect(normalizarCodigo("ABCDE-FGHJK")).toBe("ABCDE-FGHJK");
    expect(normalizarCodigo("curto")).toBe("");
  });
});

describe("senhas antigas", () => {
  it("guarda uma marca que confere só com a mesma senha", () => {
    const marca = marcarSenha("Cafe com leite 2026!");
    expect(marca).not.toContain("Cafe");
    expect(conferirMarca("Cafe com leite 2026!", marca)).toBe(true);
    expect(conferirMarca("Cafe com leite 2027!", marca)).toBe(false);
    expect(conferirMarca("qualquer", "lixo")).toBe(false);
  });
  it("cada marca tem o seu sal (a mesma senha não gera a mesma marca)", () => {
    expect(marcarSenha("Abcdef1!")).not.toBe(marcarSenha("Abcdef1!"));
  });
});

describe("aviso de segurança", () => {
  it("diz o que aconteceu e o que fazer se não foi a pessoa", () => {
    const m = montarAvisoDeSeguranca("senha-trocada", new Date("2026-11-27T15:00:00Z"));
    expect(m.assunto).toMatch(/senha/i);
    expect(m.texto).toMatch(/Se não foi você/);
    expect(m.texto).toMatch(/12:00|horário de Brasília/);
  });
  it("diz que não recebe respostas e aponta o contato, se houver", () => {
    const sem = montarAvisoDeSeguranca("entrada-travada", new Date(), "");
    expect(sem.texto).toMatch(/não recebe respostas/);
    expect(sem.texto).not.toMatch(/responda este e-mail/i);
    const com = montarAvisoDeSeguranca("entrada-travada", new Date(), "contato@handback.com.br");
    expect(com.texto).toMatch(/escreva para contato@handback\.com\.br/);
    expect(com.html).toMatch(/não recebe respostas/);
  });
  it("não leva senha nem código nenhum", () => {
    for (const e of ["senha-trocada", "duas-etapas-trocada", "duas-etapas-removida", "entrada-travada", "codigos-gerados"] as const) {
      expect(montarAvisoDeSeguranca(e).texto).not.toMatch(/\b[A-Z0-9]{5}-[A-Z0-9]{5}\b/);
    }
  });
});

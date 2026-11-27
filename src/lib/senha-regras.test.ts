import { describe, expect, it } from "vitest";
import { forcaDaSenha, problemaNaSenha, requisitosDaSenha } from "./senha-regras";

describe("regras da senha", () => {
  it("pede 8 caracteres, maiúscula, minúscula, número e especial", () => {
    expect(problemaNaSenha("Abc1!xy", "a@b.c")).toMatch(/8 caracteres/);
    expect(problemaNaSenha("abcdef1!", "a@b.c")).toMatch(/maiúscula/);
    expect(problemaNaSenha("ABCDEF1!", "a@b.c")).toMatch(/minúscula/);
    expect(problemaNaSenha("Abcdefg!", "a@b.c")).toMatch(/número/);
    expect(problemaNaSenha("Abcdefg1", "a@b.c")).toMatch(/especial/);
    expect(problemaNaSenha("Abcdef1!", "a@b.c")).toBeNull();
  });
  it("continua recusando e-mail, comum e repetitiva", () => {
    expect(problemaNaSenha("Anapaula1!2026", "anapaula@escola.test")).toMatch(/e-mail/);
    expect(problemaNaSenha("Senha123!", "a@b.c")).toMatch(/comum/);
  });
  it("mostra o que falta, requisito por requisito", () => {
    expect(requisitosDaSenha("abc")).toEqual({ tamanho: false, maiuscula: false, minuscula: true, numero: false, especial: false });
    expect(requisitosDaSenha("Abcdef1!")).toEqual({ tamanho: true, maiuscula: true, minuscula: true, numero: true, especial: true });
  });
  it("classifica em fraca, média e forte", () => {
    expect(forcaDaSenha("")).toBe("vazia");
    expect(forcaDaSenha("abc")).toBe("fraca");
    expect(forcaDaSenha("Abcdef1!")).toBe("media");
    expect(forcaDaSenha("Cafe com leite 2026!")).toBe("forte");
  });
});

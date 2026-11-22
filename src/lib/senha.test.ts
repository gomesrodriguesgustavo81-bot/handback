import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { problemaNaSenha, senhaVazada } from "./senha";

describe("problemaNaSenha", () => {
  it("aceita senha forte", () => {
    expect(problemaNaSenha("Cafe com pao 2026", "ana@escola.test")).toBeNull();
  });
  it("recusa curta, sem números, com o e-mail ou muito comum", () => {
    expect(problemaNaSenha("Curta123", "a@b.c")).toMatch(/12 caracteres/);
    expect(problemaNaSenha("sem numeros aqui", "a@b.c")).toMatch(/letras e números/);
    expect(problemaNaSenha("anapaula20262026", "anapaula@escola.test")).toMatch(/e-mail/);
    expect(problemaNaSenha("senha12345678", "a@b.c")).toMatch(/comum/);
    expect(problemaNaSenha("aaaaaaaa1111", "a@b.c")).toMatch(/repetitiva/);
  });
});

describe("senhaVazada", () => {
  const sha = createHash("sha1").update("Vazada123456").digest("hex").toUpperCase();
  it("envia só o prefixo e reconhece a senha vazada", async () => {
    let pedido = "";
    const falso = (async (url: string) => {
      pedido = url;
      return new Response(`00000000000000000000000000000000000:0\r\n${sha.slice(5)}:42\r\n`);
    }) as unknown as typeof fetch;
    expect(await senhaVazada("Vazada123456", falso)).toBe(true);
    expect(pedido.endsWith(`/range/${sha.slice(0, 5)}`)).toBe(true);
    expect(pedido).not.toContain(sha.slice(5));
  });
  it("não bloqueia se a consulta falhar", async () => {
    const quebrado = (async () => {
      throw new Error("sem rede");
    }) as unknown as typeof fetch;
    expect(await senhaVazada("Qualquer123456", quebrado)).toBe(false);
  });
});

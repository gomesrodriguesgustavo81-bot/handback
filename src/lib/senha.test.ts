import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { senhaVazada } from "./senha";

describe("senhaVazada", () => {
  const sha = createHash("sha1").update("Vazada123456!").digest("hex").toUpperCase();
  it("envia só o prefixo e reconhece a senha vazada", async () => {
    let pedido = "";
    const falso = (async (url: string) => {
      pedido = url;
      return new Response(`00000000000000000000000000000000000:0\r\n${sha.slice(5)}:42\r\n`);
    }) as unknown as typeof fetch;
    expect(await senhaVazada("Vazada123456!", falso)).toBe(true);
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

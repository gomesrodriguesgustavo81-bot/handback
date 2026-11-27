import { describe, expect, it } from "vitest";
import { usoDaResposta } from "./uso";

describe("gasto da IA", () => {
  it("soma o raciocínio do modelo na saída (também é cobrado)", () => {
    expect(usoDaResposta({ usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 300, thoughtsTokenCount: 50 } })).toEqual({ entrada: 1200, saida: 350 });
  });
  it("sem informação do Google, zero (e a análise segue)", () => {
    expect(usoDaResposta({})).toEqual({ entrada: 0, saida: 0 });
  });
  it("ignora valor que não é número ou é negativo", () => {
    expect(usoDaResposta({ usageMetadata: { promptTokenCount: "muitos", candidatesTokenCount: -4, thoughtsTokenCount: NaN } })).toEqual({ entrada: 0, saida: 0 });
  });
});

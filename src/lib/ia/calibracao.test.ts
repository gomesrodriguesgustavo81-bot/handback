import { describe, expect, it } from "vitest";
import { resumirConcordancia, tendencia } from "./calibracao";

describe("resumirConcordancia", () => {
  it("conta acertos, direção dos erros e ignora PENDENTE", () => {
    const r = resumirConcordancia([
      { ia: "BOM", final: "BOM" },
      { ia: "BOM", final: "REGULAR" },
      { ia: "EXCELENTE", final: "REGULAR" },
      { ia: "REGULAR", final: "BOM" },
      { ia: "BOM", final: "PENDENTE" },
      { ia: null, final: "BOM" },
    ]);
    expect(r.total).toBe(4);
    expect(r.iguais).toBe(1);
    expect(r.iaMaisAlta).toBe(2);
    expect(r.iaMaisBaixa).toBe(1);
    expect(r.distantes).toBe(1);
    expect(r.matriz.BOM.REGULAR).toBe(1);
    expect(r.matriz.EXCELENTE.REGULAR).toBe(1);
  });
  it("descreve a tendência", () => {
    expect(tendencia(resumirConcordancia([{ ia: "BOM", final: "BOM" }]))).toBeNull();
    expect(tendencia(resumirConcordancia(Array(4).fill({ ia: "BOM", final: "BOM" })))).toMatch(/todas/);
    expect(
      tendencia(resumirConcordancia([{ ia: "BOM", final: "REGULAR" }, { ia: "BOM", final: "RUIM" }, { ia: "BOM", final: "BOM" }])),
    ).toMatch(/generosa/);
  });
});

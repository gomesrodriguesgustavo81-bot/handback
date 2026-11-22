import { describe, expect, it } from "vitest";
import { evolucaoDaEquipe, type Celula } from "./evolucao";

const ap = (conceito: string): Celula => ({ tipo: "aprovado", conceito, entregaId: "x" });

describe("evolucaoDaEquipe", () => {
  it("compara os dois últimos conceitos aprovados", () => {
    expect(evolucaoDaEquipe([ap("RUIM"), ap("REGULAR"), ap("BOM")]).tendencia).toBe("melhorou");
    expect(evolucaoDaEquipe([ap("BOM"), { tipo: "revisar", conceito: "RUIM", entregaId: "y" }, ap("BOM")]).tendencia).toBe("manteve");
    expect(evolucaoDaEquipe([ap("EXCELENTE"), ap("REGULAR")]).tendencia).toBe("caiu");
    expect(evolucaoDaEquipe([ap("BOM")]).tendencia).toBe("sem-dados");
  });
  it("aponta quem precisa de atenção", () => {
    expect(evolucaoDaEquipe([ap("BOM"), ap("BOM")]).atencao).toBe(false);
    expect(evolucaoDaEquipe([ap("BOM"), ap("RUIM")]).motivos).toEqual(["RUIM no último conceito", "caiu em relação ao anterior"]);
    expect(evolucaoDaEquipe([{ tipo: "nao-entregou" }, ap("BOM"), { tipo: "nao-entregou" }]).motivos).toEqual(["não entregou 2 vezes"]);
    expect(evolucaoDaEquipe([{ tipo: "aguardando" }, { tipo: "sem-analise", entregaId: "z" }]).atencao).toBe(false);
  });
});

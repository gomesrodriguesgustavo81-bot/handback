import { describe, expect, it } from "vitest";
import { evolucaoDaEquipe, resumoDaTurma, type Celula } from "./evolucao";

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

describe("resumo da turma", () => {
  it("conta quem melhorou, caiu e precisa de atenção", () => {
    const etapas = [
      { id: "e1", recebe_ate: "2026-01-01" },
      { id: "e2", recebe_ate: "2026-01-08" },
    ];
    const a = (conceito: string) => ({ status: "aprovada", conceito });
    const r = resumoDaTurma(
      [{ id: "g1" }, { id: "g2" }, { id: "g3" }],
      etapas,
      [
        { grupo_id: "g1", etapa_id: "e1", analises: a("REGULAR") },
        { grupo_id: "g1", etapa_id: "e2", analises: [a("BOM")] },
        { grupo_id: "g2", etapa_id: "e1", analises: a("BOM") },
        { grupo_id: "g2", etapa_id: "e2", analises: a("RUIM") },
      ],
      "2026-02-01",
    );
    expect(r).toEqual({ melhorou: 1, caiu: 1, atencao: 2 });
  });
});

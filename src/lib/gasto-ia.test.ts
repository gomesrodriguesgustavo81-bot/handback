import { describe, expect, it } from "vitest";
import { mediaPorAnalise, mesDe, nomeDoMes, resumirGasto, type LinhaUso } from "./gasto-ia";

const l = (criado_em: string, e: number, s: number, turma_id: string | null = "t1"): LinhaUso => ({ criado_em, tokens_entrada: e, tokens_saida: s, turma_id });

describe("gasto da IA", () => {
  it("usa o mês no horário de Brasília (1h da manhã de 1º de dezembro em UTC ainda é novembro)", () => {
    expect(mesDe("2026-12-01T01:30:00Z")).toBe("2026-11");
    expect(mesDe("2026-12-01T04:00:00Z")).toBe("2026-12");
    expect(mesDe("lixo")).toBe("");
  });

  it("soma por mês, separa o mês atual e conta a reanálise (cada linha é uma chamada)", () => {
    const r = resumirGasto([l("2026-11-10T15:00:00Z", 1000, 300), l("2026-11-11T15:00:00Z", 1200, 350), l("2026-10-05T15:00:00Z", 900, 250)], "2026-11-27T12:00:00Z");
    expect(r.mesAtual).toEqual({ analises: 2, entrada: 2200, saida: 650 });
    expect(r.porMes.map((m) => m.mes)).toEqual(["2026-11", "2026-10"]);
    expect(r.total.analises).toBe(3);
  });

  it("separa por turma, maior gasto primeiro, e aceita análise sem turma", () => {
    const r = resumirGasto([l("2026-11-10T15:00:00Z", 100, 10, "t1"), l("2026-11-10T15:00:00Z", 5000, 500, "t2"), l("2026-11-10T15:00:00Z", 50, 5, null)], "2026-11-27T12:00:00Z");
    expect(r.porTurma.map((t) => t.turmaId)).toEqual(["t2", "t1", null]);
  });

  it("limita os meses mostrados e calcula a média por análise", () => {
    const muitas = Array.from({ length: 10 }, (_, i) => l(`2026-${String(i + 1).padStart(2, "0")}-15T15:00:00Z`, 100, 10));
    expect(resumirGasto(muitas, "2026-11-27T12:00:00Z").porMes).toHaveLength(6);
    expect(mediaPorAnalise({ analises: 4, entrada: 4000, saida: 1000 })).toEqual({ entrada: 1000, saida: 250 });
    expect(mediaPorAnalise({ analises: 0, entrada: 0, saida: 0 })).toEqual({ entrada: 0, saida: 0 });
  });

  it("escreve o nome do mês", () => {
    expect(nomeDoMes("2026-11")).toBe("novembro de 2026");
  });
});

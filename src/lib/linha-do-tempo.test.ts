import { describe, expect, it } from "vitest";
import {
  compararComTurma,
  compararEntregas,
  diasDeAtraso,
  montarLinhaDoTempo,
  mudancaDeConceito,
  paraEntregaDaTurma,
  podeCompararEntregas,
  type AnaliseBase,
  type EntregaBase,
  type EtapaBase,
} from "./linha-do-tempo";

const etapas: EtapaBase[] = [
  { id: "e2", numero: 2, titulo: "Pesquisa", recebe_ate: "2026-04-02" },
  { id: "e1", numero: 1, titulo: "Diagnóstico", recebe_ate: "2026-03-12" },
  { id: "e3", numero: 3, titulo: "Protótipo", recebe_ate: "2026-04-28" },
];
const item = (item: string, status: string) => ({ item, status });
const analise = (o: Partial<AnaliseBase> = {}): AnaliseBase => ({ status: "aprovada", conceito: "BOM", checklist: [], alertas: [], devolutiva: "ok", ...o });
const entrega = (grupo: string, etapa: string, a: AnaliseBase | null, o: Partial<EntregaBase> = {}): EntregaBase => ({
  id: `${grupo}-${etapa}`,
  grupo_id: grupo,
  etapa_id: etapa,
  enviada_em: "2026-03-12T15:00:00Z",
  atrasada: false,
  analises: a,
  ...o,
});

describe("linha do tempo", () => {
  it("põe as entregas em ordem e marca o que falta", () => {
    const l = montarLinhaDoTempo(etapas, [entrega("a", "e1", analise({ conceito: "REGULAR" }))], "2026-04-10");
    expect(l.map((p) => p.numero)).toEqual([1, 2, 3]);
    expect(l.map((p) => p.situacao)).toEqual(["aprovada", "nao-entregou", "aguardando"]);
  });

  it("só mostra conceito e devolutiva quando o professor aprovou", () => {
    const l = montarLinhaDoTempo(etapas, [entrega("a", "e1", analise({ status: "pronta", conceito: "BOM", devolutiva: "rascunho da IA" }))], "2026-03-01");
    expect(l[0].situacao).toBe("revisar");
    expect(l[0].conceito).toBeNull();
    expect(l[0].devolutiva).toBe("");
  });

  it("conta itens entregues e ignora lixo no checklist", () => {
    const l = montarLinhaDoTempo(
      etapas,
      [entrega("a", "e1", analise({ checklist: [item("A", "ENTREGUE"), item("B", "PARCIAL"), { x: 1 }, null, "texto"] }))],
      "2026-03-01",
    );
    expect(l[0].itens).toHaveLength(2);
    expect(l[0].entregues).toBe(1);
  });

  it("alertas só contam enquanto falta revisar", () => {
    const al = [{ tipo: "ilegivel", gravidade: "critico", texto: "x" }];
    const pronta = montarLinhaDoTempo(etapas, [entrega("a", "e1", analise({ status: "pronta", alertas: al }))], "2026-03-01")[0];
    const aprovada = montarLinhaDoTempo(etapas, [entrega("a", "e1", analise({ alertas: al }))], "2026-03-01")[0];
    expect(pronta.alertas).toBe(1);
    expect(pronta.grave).toBe(true);
    expect(aprovada.alertas).toBe(0);
  });

  it("calcula dias de atraso pelo dia de São Paulo", () => {
    expect(diasDeAtraso("2026-04-04T12:00:00Z", "2026-04-02")).toBe(2);
    expect(diasDeAtraso("2026-04-03T01:30:00Z", "2026-04-02")).toBe(0); // 22h30 do dia 2 em SP
    expect(diasDeAtraso("2026-04-04T12:00:00Z", null)).toBeNull();
    const l = montarLinhaDoTempo(etapas, [entrega("a", "e2", analise(), { atrasada: true, enviada_em: "2026-04-04T12:00:00Z" })], "2026-05-01");
    expect(l[1].atrasou).toBe(true);
    expect(l[1].diasDeAtraso).toBe(2);
  });
});

describe("comparar entregas do mesmo aluno", () => {
  it("só habilita com 2 ou mais entregas analisadas", () => {
    const uma = montarLinhaDoTempo(etapas, [entrega("a", "e1", analise())], "2026-05-01");
    const duas = montarLinhaDoTempo(etapas, [entrega("a", "e1", analise()), entrega("a", "e2", analise())], "2026-05-01");
    expect(podeCompararEntregas(uma)).toBe(false);
    expect(podeCompararEntregas(duas)).toBe(true);
  });

  it("diz se evoluiu, caiu ou manteve", () => {
    expect(mudancaDeConceito("REGULAR", "BOM")).toEqual({ mudanca: "evoluiu", degraus: 1 });
    expect(mudancaDeConceito("EXCELENTE", "RUIM")).toEqual({ mudanca: "caiu", degraus: -3 });
    expect(mudancaDeConceito("BOM", "BOM").mudanca).toBe("manteve");
    expect(mudancaDeConceito("BOM", null).mudanca).toBe("sem-comparacao");
    expect(mudancaDeConceito("PENDENTE", "BOM").mudanca).toBe("sem-comparacao");
  });

  it("mostra o que faltou antes e como ficou depois, sem ligar itens de entregas diferentes", () => {
    const l = montarLinhaDoTempo(
      etapas,
      [
        entrega("a", "e1", analise({ conceito: "REGULAR", checklist: [item("Matriz", "PARCIAL"), item("Referências", "NAO_ENTREGUE"), item("Resumo", "ENTREGUE")] })),
        entrega("a", "e2", analise({ conceito: "BOM", checklist: [item("Roteiro", "ENTREGUE"), item("Fontes", "PARCIAL")] })),
      ],
      "2026-05-01",
    );
    const c = compararEntregas(l[0], l[1]);
    expect(c.mudanca).toBe("evoluiu");
    expect(c.faltouAntes.map((f) => f.item)).toEqual(["Matriz", "Referências"]);
    expect(c.entreguesAntes).toBe(1);
    expect(c.totalAntes).toBe(3);
    expect(c.entreguesDepois).toBe(1);
    expect(c.depois.map((d) => d.item)).toEqual(["Roteiro", "Fontes"]);
  });
});

describe("comparar com a turma", () => {
  const turma = (conceitos: (string | null)[]) =>
    conceitos.map((c, i) => ({
      grupoId: `g${i}`,
      conceito: c,
      atrasou: i % 2 === 1,
      itens: [item("Fontes", i < 2 ? "ENTREGUE" : "NAO_ENTREGUE"), item("Roteiro", "ENTREGUE")],
    }));

  it("conta a distribuição e quantos tiraram o mesmo conceito", () => {
    const r = compararComTurma("g1", turma(["EXCELENTE", "BOM", "BOM", "REGULAR", "RUIM", null]));
    expect(r.aprovados).toBe(5);
    expect(r.confiavel).toBe(true);
    expect(r.distribuicao).toEqual([
      { conceito: "EXCELENTE", quantidade: 1 },
      { conceito: "BOM", quantidade: 2 },
      { conceito: "REGULAR", quantidade: 1 },
      { conceito: "RUIM", quantidade: 1 },
    ]);
    expect(r.mesmoConceito).toBe(2);
    expect(r.comPrazo).toBe(6);
    expect(r.noPrazo).toBe(3);
  });

  it("acha o item em que a turma mais tropeçou", () => {
    const r = compararComTurma("g0", turma(["BOM", "BOM", "BOM", "BOM", "BOM"]));
    expect(r.itens.find((i) => i.item === "Fontes")?.turmaCompleto).toBe(40);
    expect(r.itens.find((i) => i.item === "Roteiro")?.turmaCompleto).toBe(100);
    expect(r.maisDificil).toBe("Fontes");
    expect(r.mediaEntregues).toBe(1.4);
  });

  it("avisa que não é confiável com menos de 5 aprovados e não aponta item difícil", () => {
    const r = compararComTurma("g0", turma(["BOM", "BOM", "REGULAR"]));
    expect(r.confiavel).toBe(false);
    expect(r.maisDificil).toBeNull();
  });

  it("nunca devolve identificação de colegas", () => {
    const r = compararComTurma("g0", turma(["BOM", "BOM", "BOM", "BOM", "BOM"]));
    expect(JSON.stringify(r)).not.toMatch(/g[1-4]/);
  });

  it("ignora conceito que não existe e entrega sem análise aprovada", () => {
    const e = paraEntregaDaTurma(entrega("x", "e1", analise({ status: "pronta", conceito: "BOM" })));
    expect(e.conceito).toBeNull();
    const r = compararComTurma("x", [e, { grupoId: "y", conceito: "OUTRO", itens: [], atrasou: false }]);
    expect(r.aprovados).toBe(0);
  });
});

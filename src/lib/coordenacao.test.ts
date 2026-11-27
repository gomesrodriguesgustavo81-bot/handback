import { describe, expect, it } from "vitest";
import { resumirCoordenacao, type LinhaCoord } from "./coordenacao";

let seq = 0;
/** Uma turma com N pessoas × etapas; cada pessoa recebe a lista de conceitos por etapa (null = sem conceito aprovado). */
function turma(nome: string, prazos: (string | null)[], pessoas: { conceitos: (string | null)[]; entregou?: boolean[]; atrasou?: boolean[]; nome?: string }[]): LinhaCoord[] {
  const id = `t-${nome}`;
  return pessoas.flatMap((p, i) =>
    prazos.map((prazo, e) => ({
      turma_id: id,
      turma_nome: nome,
      turma_modo: "grupos",
      etapa_id: `${id}-e${e + 1}`,
      etapa_numero: e + 1,
      etapa_titulo: `Etapa ${e + 1}`,
      recebe_ate: prazo,
      grupo_n: i + 1,
      grupo_nome: p.nome ?? null,
      entregou: p.entregou ? p.entregou[e] : p.conceitos[e] !== null,
      atrasada: p.atrasou?.[e] ?? false,
      conceito: p.conceitos[e],
    })),
  ).map((l) => ({ ...l, _: seq++ }) as LinhaCoord);
}

describe("coordenação: resumo por turma", () => {
  const hoje = "2026-05-01";

  it("conta o último conceito de cada um e o que já devia ter chegado", () => {
    const linhas = turma("A", ["2026-03-01", "2026-04-01", "2026-12-01"], [
      { conceitos: ["REGULAR", "BOM", null] },
      { conceitos: ["BOM", "BOM", null] },
      { conceitos: ["RUIM", null, null], entregou: [true, false, false] },
    ]);
    const r = resumirCoordenacao(linhas, hoje);
    const t = r.turmas[0];
    expect(t.pessoas).toBe(3);
    expect(t.conceitosAtuais).toEqual({ EXCELENTE: 0, BOM: 2, REGULAR: 0, RUIM: 1 });
    expect(t.esperadas).toBe(6); // 2 etapas vencidas × 3 pessoas; a terceira só vence em dezembro
    expect(t.recebidas).toBe(5);
    expect(t.aprovadas).toBe(5);
    expect(r.recebidas).toBe(5);
  });

  it("rascunho da IA não conta: sem conceito aprovado a pessoa fica sem conceito", () => {
    const linhas = turma("A", ["2026-03-01"], [{ conceitos: [null], entregou: [true] }]);
    const t = resumirCoordenacao(linhas, hoje).turmas[0];
    expect(t.conceitosAtuais).toEqual({ EXCELENTE: 0, BOM: 0, REGULAR: 0, RUIM: 0 });
    expect(t.etapas[0].entregues).toBe(1);
    expect(t.etapas[0].aprovadas).toBe(0);
  });

  it("diz se a turma está melhorando ou caindo pelas tendências de cada um", () => {
    const sobe = turma("Sobe", [null, null], [{ conceitos: ["REGULAR", "BOM"] }, { conceitos: ["BOM", "EXCELENTE"] }, { conceitos: ["BOM", "REGULAR"] }]);
    const desce = turma("Desce", [null, null], [{ conceitos: ["BOM", "RUIM"] }, { conceitos: ["BOM", "REGULAR"] }, { conceitos: ["REGULAR", "BOM"] }]);
    const parado = turma("Parado", [null, null], [{ conceitos: ["BOM", "BOM"] }]);
    const novo = turma("Novo", ["2026-12-01"], [{ conceitos: [null], entregou: [false] }]);
    const r = resumirCoordenacao([...sobe, ...desce, ...parado, ...novo], hoje);
    const por = Object.fromEntries(r.turmas.map((t) => [t.nome, t.sinal]));
    expect(por).toEqual({ Sobe: "melhorando", Desce: "caindo", Parado: "estavel", Novo: "sem-dados" });
  });

  it("marca quem precisa de atenção e coloca esses primeiro", () => {
    const linhas = turma("A", ["2026-03-01", "2026-04-01"], [
      { conceitos: ["BOM", "BOM"], nome: "Bom" },
      { conceitos: ["REGULAR", "RUIM"], nome: "Caiu" },
      { conceitos: [null, null], entregou: [false, false], nome: "Faltou" },
    ]);
    const t = resumirCoordenacao(linhas, hoje).turmas[0];
    expect(t.atencao).toBe(2);
    expect(t.lista.map((p) => p.nome)).toEqual(["Caiu", "Faltou", "Bom"]);
    expect(t.lista[0].motivos.join(" ")).toMatch(/RUIM/);
  });

  it("mostra quando 'Ruim' sobe entre as duas últimas entregas com conceito", () => {
    const linhas = turma("A", [null, null, null], [
      { conceitos: ["RUIM", "RUIM", null], entregou: [true, true, false] },
      { conceitos: ["BOM", "RUIM", null], entregou: [true, true, false] },
      { conceitos: ["BOM", "BOM", null], entregou: [true, true, false] },
    ]);
    const t = resumirCoordenacao(linhas, hoje).turmas[0];
    expect(t.mudancaDeRuim).toEqual({ de: 1, para: 2, entre: [1, 2] });
  });

  it("não inventa nome: sem nome no banco, sem nome na tela", () => {
    const linhas = turma("A", [null], [{ conceitos: ["BOM"] }, { conceitos: ["RUIM"] }]);
    const t = resumirCoordenacao(linhas, hoje).turmas[0];
    expect(t.lista.every((p) => p.nome === null)).toBe(true);
  });

  it("junta atrasos e ordena as turmas por nome", () => {
    const linhas = [
      ...turma("Zeta", [null], [{ conceitos: ["BOM"], atrasou: [true] }]),
      ...turma("Alfa", [null], [{ conceitos: ["BOM"], atrasou: [true] }, { conceitos: ["BOM"], atrasou: [true] }]),
    ];
    const r = resumirCoordenacao(linhas, hoje);
    expect(r.turmas.map((t) => t.nome)).toEqual(["Alfa", "Zeta"]);
    expect(r.atrasadas).toBe(3);
  });

  it("sem linhas, sem turmas", () => {
    expect(resumirCoordenacao([], hoje)).toEqual({ turmas: [], recebidas: 0, esperadas: 0, aprovadas: 0, atrasadas: 0, atencao: 0 });
  });
});

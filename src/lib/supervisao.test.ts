import { describe, expect, it } from "vitest";
import { csvDaSupervisao, montarSupervisao, resumoSupervisao, type LinhaBruta } from "./supervisao";

const bruta = (o: Partial<LinhaBruta>): LinhaBruta => ({
  grupo: "Equipe Azul", etapaNumero: 1, etapaTitulo: "Diagnóstico", status: "aprovada", conceitoIa: "BOM", conceito: "BOM",
  escolhido: true, motivo: "", aprovadaEm: "2026-04-12T17:32:00Z", aprovadaPor: "u1", alertas: 0, ...o,
});
const quem = (id: string | null) => (id === "u1" ? "Marcos Dias" : "outra pessoa");

describe("registro de supervisão", () => {
  it("mostra o que a IA sugeriu, o que o professor decidiu e quem aprovou", () => {
    const l = montarSupervisao([bruta({ conceito: "REGULAR", motivo: "Faltou a pesquisa" })], quem)[0];
    expect(l.conceitoIa).toBe("BOM");
    expect(l.conceitoFinal).toBe("REGULAR");
    expect(l.mudou).toBe(true);
    expect(l.motivo).toBe("Faltou a pesquisa");
    expect(l.aprovadaPor).toBe("Marcos Dias");
  });

  it("o que ainda falta revisar não mostra conceito final nem aprovador", () => {
    const l = montarSupervisao([bruta({ status: "pronta", aprovadaEm: null, aprovadaPor: null })], quem)[0];
    expect(l.situacao).toBe("revisar");
    expect(l.conceitoFinal).toBeNull();
    expect(l.aprovadaPor).toBe("");
  });

  it("separa quem mudou, quem aceitou a sugestão e o que aguarda", () => {
    const linhas = montarSupervisao(
      [bruta({}), bruta({ grupo: "B", conceito: "RUIM" }), bruta({ grupo: "C", status: "pronta" }), bruta({ grupo: "D", status: "analisando" })],
      quem,
    );
    expect(linhas).toHaveLength(3);
    expect(resumoSupervisao(linhas)).toEqual({ aprovadas: 2, mudou: 1, aceitou: 1, aguardando: 1 });
  });

  it("ordena por entrega e por nome", () => {
    const l = montarSupervisao([bruta({ grupo: "Zeta", etapaNumero: 2 }), bruta({ grupo: "Beta", etapaNumero: 1 }), bruta({ grupo: "Alfa", etapaNumero: 1 })], quem);
    expect(l.map((x) => x.grupo)).toEqual(["Alfa", "Beta", "Zeta"]);
  });

  it("a planilha não vira fórmula, escapa aspas e traz o aviso de dados pessoais", () => {
    const l = montarSupervisao([bruta({ grupo: '=HIPERLINK("x")', motivo: 'disse "não"; fim' })], quem);
    const csv = csvDaSupervisao(l, "Turma A", "Entrega", "Equipe", () => "12/04/2026 14:32");
    expect(csv.startsWith("﻿Turma;Entrega;Título;Equipe;")).toBe(true);
    expect(csv).toContain("'=HIPERLINK(");
    expect(csv).toContain('"disse ""não""; fim"');
    expect(csv).toContain("Contém dados pessoais");
  });
});

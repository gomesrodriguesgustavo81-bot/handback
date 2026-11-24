import { describe, expect, it } from "vitest";
import { calcularTrilha, contarEntregas, passoAtual, rotuloDoPasso, type Contagem } from "./trilha";

const base: Contagem = {
  checklist: 3,
  faltaTarefaClassroom: false,
  total: 10,
  entregaram: 0,
  esperando: 0,
  semAnalise: 0,
  analisando: 0,
  revisar: 0,
  enviar: 0,
  enviadas: 0,
  prazoPassou: false,
};

describe("trilha do ciclo", () => {
  it("sem checklist ou sem tarefa no Classroom fica no passo 1", () => {
    expect(passoAtual({ ...base, checklist: 0 })).toBe(1);
    expect(passoAtual({ ...base, faltaTarefaClassroom: true })).toBe(1);
  });
  it("sem entregas fica em Receber", () => {
    expect(passoAtual(base)).toBe(2);
  });
  it("arquivos esperando no Classroom pedem para trazer antes de analisar", () => {
    expect(passoAtual({ ...base, entregaram: 3, esperando: 2, semAnalise: 3 })).toBe(2);
  });
  it("segue a ordem analisar → revisar → enviar", () => {
    expect(passoAtual({ ...base, entregaram: 5, semAnalise: 1, revisar: 4 })).toBe(3);
    expect(passoAtual({ ...base, entregaram: 5, revisar: 4, enviar: 1 })).toBe(4);
    expect(passoAtual({ ...base, entregaram: 5, enviar: 5 })).toBe(5);
  });
  it("tudo enviado: espera mais entregas até o prazo, depois conclui", () => {
    expect(passoAtual({ ...base, entregaram: 5, enviadas: 5 })).toBe(2);
    expect(passoAtual({ ...base, entregaram: 5, enviadas: 5, prazoPassou: true })).toBe(6);
    expect(passoAtual({ ...base, entregaram: 10, enviadas: 10 })).toBe(6);
  });
  it("marca feito, agora e depois", () => {
    const t = calcularTrilha({ ...base, entregaram: 5, revisar: 5 });
    expect(t.passos.map((p) => p.estado)).toEqual(["feito", "feito", "feito", "agora", "depois"]);
    expect(t.passos[3].resumo).toBe("5 devolutivas esperando você");
    expect(rotuloDoPasso(t)).toBe("Passo 4 de 5 · Revisar");
  });
  it("conta as entregas pela situação da análise", () => {
    const agora = Date.parse("2026-11-25T12:00:00Z");
    const a = (status: string, extra: Record<string, string | null> = {}) => ({ status, iniciada_em: null, enviada_em: null, moodle_enviada_em: null, classroom_enviada_em: null, ...extra });
    const r = contarEntregas(
      [
        { id: "1", etapa_id: "e", grupo_id: "g1", analises: null },
        { id: "2", etapa_id: "e", grupo_id: "g2", analises: [a("pronta")] },
        { id: "3", etapa_id: "e", grupo_id: "g3", analises: a("aprovada") },
        { id: "4", etapa_id: "e", grupo_id: "g4", analises: a("aprovada", { classroom_enviada_em: "2026-11-25" }) },
        { id: "5", etapa_id: "e", grupo_id: "g5", analises: a("analisando", { iniciada_em: "2026-11-25T11:58:00Z" }) },
        { id: "6", etapa_id: "e", grupo_id: "g6", analises: a("analisando", { iniciada_em: "2026-11-25T10:00:00Z" }) },
        { id: "7", etapa_id: "e", grupo_id: "g7", analises: null },
      ],
      new Set(["7"]),
      agora,
    );
    expect(r).toEqual({ entregaram: 7, semAnalise: 2, analisando: 2, revisar: 1, enviar: 1, enviadas: 1 });
  });
});

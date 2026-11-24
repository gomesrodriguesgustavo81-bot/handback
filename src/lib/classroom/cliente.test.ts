import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { entregueEm, prazoDaTarefa, prazoParaClassroom } = await import("./cliente");

describe("datas do Classroom", () => {
  it("prazo em UTC vira o dia certo em Brasília", () => {
    expect(prazoDaTarefa({ id: "1", title: "x", dueDate: { year: 2099, month: 3, day: 10 }, dueTime: { hours: 2, minutes: 59 } })).toBe("2099-03-09");
    expect(prazoDaTarefa({ id: "1", title: "x", dueDate: { year: 2099, month: 3, day: 10 }, dueTime: { hours: 15 } })).toBe("2099-03-10");
    expect(prazoDaTarefa({ id: "1", title: "x" })).toBeNull();
  });
  it("prazo do Handback vira 23:59 de Brasília no Classroom (ida e volta)", () => {
    const p = prazoParaClassroom("2099-12-31");
    expect(p).toEqual({ dueDate: { year: 2100, month: 1, day: 1 }, dueTime: { hours: 2, minutes: 59 } });
    expect(prazoDaTarefa({ id: "1", title: "x", ...p })).toBe("2099-12-31");
  });
  it("hora da entrega é a última vez que o aluno entregou (não muda com a nota)", () => {
    expect(
      entregueEm({
        id: "e",
        userId: "u",
        state: "RETURNED",
        updateTime: "2026-05-09T00:00:00Z",
        submissionHistory: [
          { stateHistory: { state: "TURNED_IN", stateTimestamp: "2026-05-01T10:00:00Z" } },
          { stateHistory: { state: "RECLAIMED_BY_STUDENT", stateTimestamp: "2026-05-02T10:00:00Z" } },
          { stateHistory: { state: "TURNED_IN", stateTimestamp: "2026-05-03T10:00:00Z" } },
        ],
      }),
    ).toBe("2026-05-03T10:00:00Z");
  });
});

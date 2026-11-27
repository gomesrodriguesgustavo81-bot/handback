import { describe, expect, it } from "vitest";
import { ESCOLHAS_PADRAO, resolverEscolhas } from "./escolhas";

describe("escolhas da IA", () => {
  it("sem nada guardado, vale o padrão: o professor decide e os dados ficam protegidos", () => {
    expect(resolverEscolhas(null)).toEqual(ESCOLHAS_PADRAO);
    expect(ESCOLHAS_PADRAO.exigirConceito && ESCOLHAS_PADRAO.nomeCodigo && ESCOLHAS_PADRAO.esconderDados).toBe(true);
    expect(ESCOLHAS_PADRAO.semSugestao || ESCOLHAS_PADRAO.pedirMotivo).toBe(false);
  });
  it("a conta define o padrão e a turma muda só o que escolheu", () => {
    const conta = { ia_sem_sugestao: true, ia_pedir_motivo: true, ia_exigir_conceito: false };
    const r = resolverEscolhas(conta, { ia_sem_sugestao: false, ia_pedir_motivo: null });
    expect(r.semSugestao).toBe(false);
    expect(r.pedirMotivo).toBe(true);
    expect(r.exigirConceito).toBe(false);
    expect(r.nomeCodigo).toBe(true);
  });
});

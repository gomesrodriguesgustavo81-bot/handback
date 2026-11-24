import { describe, expect, it } from "vitest";
import { partesDaAnalise } from "./analise-interna";

describe("análise interna em partes", () => {
  it("separa os tópicos do texto corrido", () => {
    const p = partesDaAnalise(
      "Pontos fortes: Nenhum ponto forte identificado nesta entrega. Lacunas: Ausência completa do roteiro; sem o vídeo. Riscos: Atraso no projeto. Sugestão de intervenção: Orientar a equipe a conferir os anexos.",
    );
    expect(p?.map((x) => x.tipo)).toEqual(["fortes", "lacunas", "riscos", "fazer"]);
    expect(p?.[1].itens).toEqual(["Ausência completa do roteiro", "Sem o vídeo"]);
    expect(p?.[3].titulo).toBe("O que fazer");
  });
  it("aceita um tópico por linha, com marcadores", () => {
    const p = partesDaAnalise("Pontos fortes:\n- boa pesquisa\n- fontes citadas\nLacunas:\n- sem conclusão");
    expect(p?.[0].itens).toEqual(["Boa pesquisa", "Fontes citadas"]);
    expect(p?.[1].itens).toEqual(["Sem conclusão"]);
  });
  it("texto sem tópicos fica como veio", () => {
    expect(partesDaAnalise("Entrega boa, sem observações.")).toBeNull();
    expect(partesDaAnalise("")).toBeNull();
  });
});

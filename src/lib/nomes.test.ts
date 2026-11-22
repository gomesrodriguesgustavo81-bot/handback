import { describe, expect, it } from "vitest";
import { completarVocabulario, generoDe, lerListaDePessoas, o, plural, quemEntrega } from "./nomes";

describe("plural", () => {
  it("segue as regras do português para nomes comuns", () => {
    expect(plural("Aula")).toBe("Aulas");
    expect(plural("Time")).toBe("Times");
    expect(plural("Mês")).toBe("Meses");
    expect(plural("Módulo")).toBe("Módulos");
    expect(plural("Item")).toBe("Itens");
    expect(plural("Mentor")).toBe("Mentores");
    expect(plural("Responsável")).toBe("Responsáveis");
    expect(plural("Papel")).toBe("Papéis");
    expect(plural("Equipe de projeto")).toBe("Equipes de projeto");
    expect(plural("Sprints")).toBe("Sprints");
  });
});

describe("gênero e artigos", () => {
  it("acerta as palavras usadas no Handback", () => {
    expect(generoDe("Equipe")).toBe("f");
    expect(generoDe("Time")).toBe("m");
    expect(generoDe("Turma")).toBe("f");
    expect(generoDe("Ciclo")).toBe("m");
    expect(generoDe("Mentoria")).toBe("f");
    const v = completarVocabulario({ etapa: "Aula", etapas: "Aulas", avaliador: "Professor", avaliadores: "Professores", grupo: "Equipe", grupos: "Equipes" });
    expect(o(v, "etapa")).toBe("a");
    expect(o(v, "grupo", true)).toBe("as");
    expect(v.espaco).toBe("Turma");
    expect(quemEntrega({ ...v, pessoa: "Aluno", pessoas: "Alunos" }, "individual").varios).toBe("Alunos");
  });
});

describe("lerListaDePessoas", () => {
  it("entende vários formatos e aponta problemas", () => {
    const r = lerListaDePessoas("Ana Souza; ANA@x.com\nBruno Lima <bruno@x.com>\nCarla, carla@x.com\nDiego\nrenata.alves@x.com\nRepetida <ana@x.com>");
    expect(r.map((x) => [x.nome, x.email, x.erro])).toEqual([
      ["Ana Souza", "ana@x.com", ""],
      ["Bruno Lima", "bruno@x.com", ""],
      ["Carla", "carla@x.com", ""],
      ["Diego", "", "falta o e-mail"],
      ["Renata Alves", "renata.alves@x.com", ""],
      ["Repetida", "ana@x.com", "repetido na lista"],
    ]);
  });
});

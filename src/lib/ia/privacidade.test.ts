import { describe, expect, it } from "vitest";
import { acharDadosPessoais, codigoDoGrupo, cpfValido, mascarar } from "./privacidade";

describe("proteção dos dados do aluno", () => {
  it("esconde e-mail, telefone e CPF", () => {
    const t = "Contato: ana.souza@escola.test, (11) 99999-8888 e 11 98888-7777. CPF 529.982.247-25.";
    expect(mascarar(t)).toBe("Contato: [e-mail], [telefone] e [telefone]. CPF [cpf].");
  });

  it("só trata como CPF o que passa na conferência dos dígitos", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("123.456.789-00")).toBe(false);
    expect(mascarar("Protocolo 12345678901 aberto")).toBe("Protocolo 12345678901 aberto");
    expect(mascarar("CPF 52998224725")).toBe("CPF [cpf]");
  });

  it("não confunde anos, datas e valores com telefone", () => {
    for (const t of ["No período 2020-2021 foram 3.500 casos", "Em 12/03/2024 houve 45 inscritos", "Orçamento de R$ 1.234,56 por mês", "Página 15 de 120", "Nota 8,5 de 10"]) {
      expect(mascarar(t)).toBe(t);
    }
  });

  it("esconde nomes do cadastro por inteiro, sem ligar para maiúsculas e acentos", () => {
    const t = "Trabalho de Ana Souza e JOÃO PEREIRA. A equipe Azul entregou. Ana disse que sim.";
    const r = mascarar(t, ["Ana Souza", "João Pereira"]);
    expect(r).toBe("Trabalho de [nome] e [nome]. A equipe Azul entregou. Ana disse que sim.");
  });

  it("não esconde nome curto ou comum que estragaria o texto", () => {
    expect(mascarar("O céu azul e a Ana", ["Ana", "Azul"])).toBe("O céu azul e a Ana");
  });

  it("não escolhe pedaço de palavra", () => {
    expect(mascarar("Mariana Souzara foi", ["Ana Souza"])).toBe("Mariana Souzara foi");
  });

  it("conta o que encontrou, para avisar o professor", () => {
    expect(acharDadosPessoais("tel (21) 3333-4444, cel 21 98888-7777, cpf 529.982.247-25, a@b.co")).toEqual({ cpf: 1, telefone: 2, email: 1 });
    expect(acharDadosPessoais("nada aqui, só 2020-2021")).toEqual({ cpf: 0, telefone: 0, email: 0 });
  });

  it("o código do aluno é sempre o mesmo e não mostra o nome", () => {
    const a = codigoDoGrupo("3f9k2a11-aaaa-bbbb-cccc-111122223333", "Aluno");
    expect(a).toBe("Aluno 3F9K");
    expect(codigoDoGrupo("3f9k2a11-aaaa-bbbb-cccc-111122223333", "Aluno")).toBe(a);
  });
});

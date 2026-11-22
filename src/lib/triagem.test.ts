import { describe, expect, it } from "vitest";
import { autorOriginal, extrairLinks, triar, type ContextoTriagem, type EmailParaTriagem } from "./triagem";

const ctx: ContextoTriagem = {
  etiqueta: "ENTREGA",
  modo: "confirmar",
  assuntosIgnorar: "cadastro, bolsista, contrat, comprovante, document, fatura, holerite, ficha, pagamento, lembrete",
  palavraEtapa: "Aula",
  etapas: [
    { id: "a1", numero: 1, recebe_de: "2026-11-01", recebe_ate: "2026-11-07" },
    { id: "a2", numero: 2, recebe_de: "2026-11-08", recebe_ate: "2026-11-14" },
  ],
  grupos: [
    { id: "g1", nome: "Fleury - Saúde Digital", emails: ["ana@aluno.test", "bia@aluno.test"] },
    { id: "g2", nome: "Google/FAU", emails: ["caio@aluno.test"] },
  ],
  emailsDaEquipe: ["prof@escola.test", "assistente@escola.test"],
  mensagensComEntrega: ["<antiga@mail>"],
};

function email(parcial: Partial<EmailParaTriagem>): EmailParaTriagem {
  return {
    deEmail: "ana@aluno.test",
    assunto: "[ENTREGA] Aula 2 - Fleury",
    texto: "Segue nossa entrega.",
    html: "",
    enviadoEm: new Date("2026-11-10T15:00:00-03:00"),
    respondeA: [],
    quantidadeDeAnexos: 1,
    ...parcial,
  };
}

describe("triagem de e-mails (regras do protótipo)", () => {
  it("assunto no padrão + remetente cadastrado → entrega", () => {
    const r = triar(email({}), ctx);
    expect(r).toMatchObject({ status: "entrega", etapaId: "a2", grupoId: "g1" });
  });

  it("aceita RE:/ENC: antes da etiqueta e maiúsculas/acentos variados", () => {
    expect(triar(email({ assunto: "ENC: [Entrega] aula nº 1 – Fleury" }), ctx)).toMatchObject({ status: "entrega", etapaId: "a1" });
  });

  it("sem número no assunto, usa a data do envio", () => {
    const r = triar(email({ assunto: "[ENTREGA] Fleury" }), ctx);
    expect(r).toMatchObject({ status: "entrega", etapaId: "a2" });
  });

  it('"Aula 11/11" é uma data, não a Aula 11', () => {
    const r = triar(email({ assunto: "[ENTREGA] Aula 11/11 - Fleury" }), ctx);
    expect(r).toMatchObject({ status: "entrega", etapaId: "a2" });
  });

  it("número de aula que não existe → para confirmar", () => {
    const r = triar(email({ assunto: "[ENTREGA] Aula 9 - Fleury" }), ctx);
    expect(r.status).toBe("confirmar");
    expect(r.avisos.join(" ")).toContain("número 9");
  });

  it("depois de todos os prazos → para confirmar, com sugestão da última aula", () => {
    const r = triar(email({ assunto: "[ENTREGA] Fleury", enviadoEm: new Date("2026-11-20T10:00:00-03:00") }), ctx);
    expect(r).toMatchObject({ status: "confirmar", etapaId: "a2" });
  });

  it("remetente não cadastrado mas com etiqueta e nome do grupo → para confirmar com sugestão", () => {
    const r = triar(email({ deEmail: "novo@aluno.test", assunto: "[ENTREGA] Aula 2 - Google/FAU" }), ctx);
    expect(r).toMatchObject({ status: "confirmar", grupoId: "g2", motivo: "remetente não cadastrado" });
  });

  it("remetente desconhecido, sem etiqueta → ignorado", () => {
    expect(triar(email({ deEmail: "spam@x.test", assunto: "Promoção" }), ctx).status).toBe("ignorado");
  });

  it("fora do padrão com anexo → para confirmar; no modo automático → entrega", () => {
    expect(triar(email({ assunto: "Trabalho da semana" }), ctx).status).toBe("confirmar");
    expect(triar(email({ assunto: "Trabalho da semana" }), { ...ctx, modo: "automatico" }).status).toBe("entrega");
  });

  it('"Entrega aula 2" sem colchetes, com anexo, conta como etiqueta', () => {
    expect(triar(email({ assunto: "Entrega aula 2" }), ctx).status).toBe("entrega");
  });

  it("dúvida sobre a entrega (etiqueta no meio do assunto, sem anexo) → ignorado", () => {
    const r = triar(email({ assunto: "Dúvida sobre a entrega da aula 2", quantidadeDeAnexos: 0 }), ctx);
    expect(r.status).toBe("ignorado");
  });

  it("documentos pessoais (bolsista, contrato…) são ignorados mesmo com anexo", () => {
    expect(triar(email({ assunto: "Documentos bolsista - RG e CPF" }), ctx)).toMatchObject({ status: "ignorado" });
    expect(triar(email({ assunto: "Contrato assinado" }), ctx).status).toBe("ignorado");
  });

  it('"Obrigado, professor!" na conversa da entrega, sem anexo → ignorado', () => {
    const r = triar(
      email({ assunto: "RE: [ENTREGA] Aula 2 - Fleury", respondeA: ["<antiga@mail>"], quantidadeDeAnexos: 0, texto: "Obrigado, professor!" }),
      ctx,
    );
    expect(r).toMatchObject({ status: "ignorado", motivo: "resposta na conversa, sem arquivo ou link novo" });
  });

  it("reenvio na mesma conversa COM arquivo novo → entrega", () => {
    expect(triar(email({ assunto: "RE: [ENTREGA] Aula 2 - Fleury", respondeA: ["<antiga@mail>"] }), ctx).status).toBe("entrega");
  });

  it("mensagem do professor não conta; encaminhamento manual de aluno conta", () => {
    expect(triar(email({ deEmail: "prof@escola.test" }), ctx).status).toBe("ignorado");
    const enc = triar(
      email({
        deEmail: "prof@escola.test",
        assunto: "Fwd: [ENTREGA] Aula 2 - Fleury",
        texto: "---------- Forwarded message ---------\nDe: Ana <ana@aluno.test>\nDate: ...\n\nSegue",
      }),
      ctx,
    );
    expect(enc).toMatchObject({ status: "entrega", grupoId: "g1" });
    expect(enc.avisos.join(" ")).toContain("autor original: ana@aluno.test");
  });

  it("confirmação de encaminhamento do Gmail vai para confirmar, com aviso", () => {
    const r = triar(email({ deEmail: "forwarding-noreply@google.com", assunto: "(#123) Confirmação de encaminhamento", quantidadeDeAnexos: 0 }), ctx);
    expect(r.status).toBe("confirmar");
    expect(r.avisos[0]).toContain("confirmar o encaminhamento");
  });

  it("link do Drive conta como conteúdo", () => {
    const r = triar(email({ assunto: "Trabalho", quantidadeDeAnexos: 0, texto: "Link: https://docs.google.com/presentation/d/abc/edit" }), ctx);
    expect(r.status).toBe("confirmar");
    expect(r.links).toEqual(["https://docs.google.com/presentation/d/abc/edit"]);
  });

  it("palavra da etapa configurada pela empresa (Ciclo 2)", () => {
    const r = triar(email({ assunto: "[ENTREGA] Ciclo 1 - Fleury" }), { ...ctx, palavraEtapa: "Ciclo" });
    expect(r).toMatchObject({ status: "entrega", etapaId: "a1" });
  });
});

describe("apoio", () => {
  it("extrai links do texto e do html, sem repetir e sem links de descadastro", () => {
    const links = extrairLinks(
      "Veja https://figma.com/file/x. e https://figma.com/file/x?y=1",
      '<a href="https://drive.google.com/a">a</a><a href="https://x.com/unsubscribe">sair</a>',
    );
    expect(links).toEqual(["https://figma.com/file/x", "https://drive.google.com/a"]);
  });

  it("acha o autor original num encaminhamento em português", () => {
    expect(autorOriginal("---------- Mensagem encaminhada ---------\nDe: Caio <CAIO@aluno.test>\n")).toBe("caio@aluno.test");
  });
});

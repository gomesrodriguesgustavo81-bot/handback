// "Gemini de mentira" para testes: responde no mesmo formato da API do Google.
//  - modelo "modelo-sem-cota" → 429 (cota esgotada), para testar a troca de modelo;
//  - texto com FORCAR_ERRO → 500 sempre, para testar a mensagem de falha;
//  - confere a chave e se o pedido tem as regras e o formato de resposta.
// Uso: node scripts/gemini-falso.mjs [porta] [arquivo-de-registro]
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";

const porta = Number(process.argv[2] ?? 4555);
const registro = process.argv[3];

createServer(async (req, res) => {
  let corpo = "";
  for await (const parte of req) corpo += parte;
  const responder = (status, json) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(json));
  };
  const modelo = req.url.match(/models\/([^:]+):generateContent/)?.[1];
  if (!modelo) return responder(404, { error: { message: "rota desconhecida" } });
  if (req.headers["x-goog-api-key"] !== "chave-de-teste") return responder(400, { error: { message: "API key not valid" } });

  const j = JSON.parse(corpo);
  const partes = j.contents?.[0]?.parts ?? [];
  const texto = partes.filter((p) => p.text).map((p) => p.text).join("\n");
  if (registro) {
    appendFileSync(
      registro,
      JSON.stringify({
        modelo,
        temRegras: /NUNCA use notas/.test(j.systemInstruction?.parts?.[0]?.text ?? ""),
        temEsquema: Boolean(j.generationConfig?.responseSchema),
        correcoes: (j.systemInstruction?.parts?.[0]?.text ?? "").split("CORREÇÕES ANTERIORES")[1]?.split("\n\n")[0] ?? "",
        anexos: partes.filter((p) => p.inlineData).map((p) => p.inlineData.mimeType),
        texto: texto.slice(0, 4000),
      }) + "\n",
    );
  }
  if (modelo === "modelo-sem-cota") return responder(429, { error: { message: "Quota exceeded for this model" } });
  if (texto.includes("FORCAR_ERRO")) return responder(500, { error: { message: "erro interno simulado" } });

  // Plano de ensino: devolve as entregas que achou no texto ("Entrega N: título até AAAA-MM-DD").
  if (/PLANO DE ENSINO/.test(j.systemInstruction?.parts?.[0]?.text ?? "")) {
    const ciclos = [...texto.matchAll(/Entrega (\d+): ([^\n]+?) até (\d{4}-\d{2}-\d{2})(?: \(([^)]*)\))?/g)].map((m) => ({
      numero: Number(m[1]),
      titulo: m[2].trim(),
      data: "",
      recebe_de: "",
      recebe_ate: m[3],
      entregaveis: (m[4] ?? "").split(";").map((x) => x.trim()).filter(Boolean),
      criterios: "",
    }));
    return responder(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ ciclos }) }] }, finishReason: "STOP" }] });
  }

  const bloco = texto.split("ITENS PEDIDOS")[1]?.split("\n\n")[0] ?? "";
  const itens = [...bloco.matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1]);
  const grupo = texto.match(/^[A-ZÇÃÉ ]+: (.+)$/m)?.[1] ?? "grupo";
  const resultado = {
    checklist: itens.map((item, i) => ({
      item,
      status: i === 0 ? "ENTREGUE" : "PARCIAL",
      evidencia: i === 0 ? "Aparece no material enviado." : "Está lá, mas incompleto.",
    })),
    conceito: "EXCELENTE",
    justificativa_conceito: "Entrega consistente com as métricas; detalhes menores nos itens parciais.",
    analise_professor: "Pontos fortes: clareza. Lacunas: detalhes. Riscos: nenhum. Sugestão: revisar referências.",
    feedback_equipe: `Pessoal, excelente entrega! O material de ${grupo} está muito bem estruturado. Só precisamos dar atenção aos detalhes que ficaram parciais. Parabéns pelo trabalho, continuem nesse ritmo!`,
  };
  // Teste dos alertas: a "IA" percebe uma inconsistência e (de propósito) tenta decidir "incompleta",
  // que o Handback calcula sozinho e precisa descartar.
  if (texto.includes("TESTE_ALERTA_IA")) {
    resultado.alertas = [
      { tipo: "inconsistente", gravidade: "critico", explicacao: "Os números da página 3 não batem com os da página 5." },
      { tipo: "incompleta", gravidade: "critico", explicacao: "A IA não deveria decidir este tipo." },
    ];
  }
  responder(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(resultado) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 1200, candidatesTokenCount: 300, thoughtsTokenCount: 50, totalTokenCount: 1550 } });
}).listen(porta, "127.0.0.1", () => console.log(`Gemini falso em http://127.0.0.1:${porta}`));

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
  responder(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(resultado) }] }, finishReason: "STOP" }] });
}).listen(porta, "127.0.0.1", () => console.log(`Gemini falso em http://127.0.0.1:${porta}`));

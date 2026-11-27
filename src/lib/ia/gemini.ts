import "server-only";
import type { ParteIA } from "./leitura";
import { usoDaResposta, type UsoIA } from "./uso";

/**
 * Chama o Gemini tentando: modelo configurado → reservas. Em sobrecarga
 * (429/503) espera e tenta de novo; com cota esgotada passa para o próximo
 * modelo; se o Google indicar um modelo substituto, tenta ele.
 * A chave fica só no servidor (variável GEMINI_API_KEY).
 */
const MODELOS_RESERVA = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const TEMPO_TOTAL_MS = 4 * 60 * 1000;

export class ErroIA extends Error {}

export function iaConfigurada(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function chamarGemini(
  sistema: string,
  partes: ParteIA[],
  esquema: object,
): Promise<{ resultado: unknown; modelo: string; uso: UsoIA }> {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) throw new ErroIA("A chave da IA (GEMINI_API_KEY) ainda não foi configurada no servidor.");
  const base = (process.env.GEMINI_API_BASE ?? "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const modelos = [...new Set([process.env.HANDBACK_IA_MODELO, ...MODELOS_RESERVA].map((m) => (m ?? "").trim()).filter(Boolean))];

  const erros: string[] = [];
  const semCota: string[] = [];
  const inicio = Date.now();
  let raciocinioBaixo = true;

  for (let i = 0; i < modelos.length; i++) {
    const modelo = modelos[i];
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      if (Date.now() - inicio > TEMPO_TOTAL_MS) throw new ErroIA(`A IA demorou demais.\n${erros.join("\n")}`);
      const generationConfig: Record<string, unknown> = { responseMimeType: "application/json", responseSchema: esquema };
      if (raciocinioBaixo && /^gemini-3/.test(modelo)) generationConfig.thinkingConfig = { thinkingLevel: "low" };

      let resp: Response;
      try {
        resp = await fetch(`${base}/v1beta/models/${modelo}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": chave },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: sistema }] },
            contents: [{ role: "user", parts: partes }],
            generationConfig,
          }),
          signal: AbortSignal.timeout(150_000),
        });
      } catch (e) {
        erros.push(`${modelo}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200));
        if (e instanceof Error && /timeout|abort/i.test(e.name + e.message)) break;
        await esperar(2000);
        continue;
      }

      const texto = await resp.text();
      if (resp.status === 200) {
        try {
          const j = JSON.parse(texto);
          const cand = j.candidates?.[0];
          const saida = (cand?.content?.parts ?? [])
            .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
            .map((p: { text: string }) => p.text)
            .join("");
          if (!saida) throw new Error(`resposta vazia (${cand?.finishReason ?? j.promptFeedback?.blockReason ?? "?"})`);
          return { resultado: JSON.parse(saida.replace(/^```(json)?\s*|```\s*$/g, "")), modelo, uso: usoDaResposta(j) };
        } catch (e) {
          erros.push(`${modelo}: ${e instanceof Error ? e.message : String(e)}`);
          break;
        }
      }

      let detalhe = texto.slice(0, 200);
      try {
        detalhe = JSON.parse(texto).error.message;
      } catch {
        /* mantém o texto */
      }
      erros.push(`${modelo}: HTTP ${resp.status} — ${detalhe}`);
      if (resp.status === 400 && /thinking/i.test(detalhe) && raciocinioBaixo) {
        raciocinioBaixo = false;
        erros.pop();
        tentativa--;
        continue;
      }
      if ((resp.status === 400 || resp.status === 403) && /API key/i.test(detalhe)) {
        throw new ErroIA("A chave da IA é inválida. Gere outra em aistudio.google.com/apikey e atualize no servidor.");
      }
      const novo = detalhe.match(/use models\/([\w.\-]+)/i)?.[1];
      if (novo && !modelos.includes(novo)) modelos.splice(i + 1, 0, novo);
      if (resp.status === 429 && /quota|exceeded|exhausted/i.test(detalhe)) {
        semCota.push(modelo);
        break;
      }
      if ((resp.status === 429 || resp.status >= 500) && tentativa < 3) {
        await esperar(3000 * tentativa);
        continue;
      }
      break;
    }
  }

  if (semCota.length === modelos.length) {
    throw new ErroIA(`Cota da IA esgotada em todos os modelos. Tente mais tarde ou ative o faturamento da chave.\n${erros.join("\n")}`);
  }
  throw new ErroIA(`A IA não respondeu (${erros.map((e) => e.replace(/ — .*/, "")).join(" · ")}).\n${erros.join("\n")}`);
}

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

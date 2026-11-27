/** Quanto a chamada gastou (o que o Google informa na resposta). Saída inclui o "raciocínio" do modelo, que também é cobrado. */
export type UsoIA = { entrada: number; saida: number };

function numero(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0;
}

export function usoDaResposta(j: { usageMetadata?: { promptTokenCount?: unknown; candidatesTokenCount?: unknown; thoughtsTokenCount?: unknown } }): UsoIA {
  const u = j.usageMetadata;
  return { entrada: numero(u?.promptTokenCount), saida: numero(u?.candidatesTokenCount) + numero(u?.thoughtsTokenCount) };
}


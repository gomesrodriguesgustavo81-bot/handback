import "server-only";

/**
 * Endereço de recebimento de uma empresa: o endereço base do serviço de
 * recebimento (variável HANDBACK_EMAIL_RECEBIMENTO, ex.: "entregas@caixa.exemplo")
 * com o código da empresa depois do "+": "entregas+abc123def456@caixa.exemplo".
 */
export function enderecoDeRecebimento(codigo: string): string | null {
  const base = (process.env.HANDBACK_EMAIL_RECEBIMENTO ?? "").trim().toLowerCase();
  const m = base.match(/^([^@\s+]+)@([^@\s]+\.[^@\s]+)$/);
  if (!m) return null;
  return `${m[1]}+${codigo}@${m[2]}`;
}

/**
 * Limites dos planos dos serviços que o Handback usa (grátis, por padrão).
 * Quando um plano mudar (ex.: Supabase Pro), ajuste pelas variáveis
 * HANDBACK_LIMITE_* na Vercel, sem mexer no código.
 */
function num(nome: string, padrao: number): number {
  const v = Number(process.env[nome]);
  return Number.isFinite(v) && v > 0 ? v : padrao;
}

export function limites() {
  return {
    arquivosBytes: num("HANDBACK_LIMITE_ARQUIVOS_MB", 1024) * 1024 * 1024,
    bancoBytes: num("HANDBACK_LIMITE_BANCO_MB", 500) * 1024 * 1024,
    analisesDia: num("HANDBACK_LIMITE_IA_DIA", 250),
    emailsDia: num("HANDBACK_LIMITE_EMAILS_DIA", 100),
    emailsMes: num("HANDBACK_LIMITE_EMAILS_MES", 3000),
    emailsLoginHora: num("HANDBACK_LIMITE_EMAILS_LOGIN_HORA", 2),
    gmails: num("HANDBACK_LIMITE_GMAILS", 100),
    pessoas: num("HANDBACK_LIMITE_PESSOAS", 50000),
  };
}

export type Uso = {
  arquivos_bytes: number;
  banco_bytes: number;
  analises_hoje: number;
  analises_mes: number;
  emails_hoje: number;
  emails_mes: number;
  emails_login_hora: number | null;
  gmails_conectados: number;
  pessoas: number;
  espacos: number;
};

/** Situação de uso: ok (até 70%), atencao (até 90%) ou cheio. */
export function nivel(usado: number, limite: number): "ok" | "atencao" | "cheio" {
  const p = limite > 0 ? usado / limite : 0;
  return p >= 0.9 ? "cheio" : p >= 0.7 ? "atencao" : "ok";
}

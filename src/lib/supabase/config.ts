/**
 * Endereço e chave pública do Supabase, lidos das variáveis de ambiente.
 *
 * Aceita os nomes que nós cadastramos (NEXT_PUBLIC_…) e também os que a
 * integração Supabase + Vercel cria sozinha (SUPABASE_URL, SUPABASE_ANON_KEY…).
 * Só lê chaves PÚBLICAS ("publishable" ou "anon"): quem protege os dados são as
 * regras de acesso do banco (Row Level Security). A chave secreta/service_role
 * nunca é usada pelo Handback.
 */
export function lerConfigSupabase(): { url: string; chave: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const chave =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY;
  if (!url || !chave) return null;
  return { url, chave };
}

export function supabaseConfigurado(): boolean {
  return lerConfigSupabase() !== null;
}

/**
 * Endereço e chave pública do Supabase, lidos das variáveis de ambiente.
 * A chave "publishable" (ou a antiga "anon") é pública por natureza: quem
 * protege os dados são as regras de acesso do banco (Row Level Security).
 */
export function lerConfigSupabase(): { url: string; chave: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !chave) return null;
  return { url, chave };
}

export function supabaseConfigurado(): boolean {
  return lerConfigSupabase() !== null;
}

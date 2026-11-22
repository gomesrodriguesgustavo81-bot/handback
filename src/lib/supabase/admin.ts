import "server-only";
import { createClient } from "@supabase/supabase-js";
import { lerConfigSupabase } from "./config";

/**
 * Cliente do Supabase com a chave SECRETA — usado só no servidor, só no
 * recebimento de e-mails (quando não há ninguém logado). Nunca vai para o
 * navegador. Aceita os nomes que a integração Supabase + Vercel cria.
 */
export function criarClienteAdmin() {
  const config = lerConfigSupabase();
  const segredo = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !segredo) return null;
  return createClient(config.url, segredo, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

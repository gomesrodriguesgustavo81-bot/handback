import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { lerConfigSupabase } from "./config";

/** Cliente do Supabase para usar no servidor (páginas, ações e rotas). */
export async function criarClienteServidor() {
  const config = lerConfigSupabase();
  if (!config) {
    throw new Error("O Supabase ainda não foi configurado (veja o arquivo .env.example).");
  }
  const loja = await cookies();
  return createServerClient(config.url, config.chave, {
    cookies: {
      getAll() {
        return loja.getAll();
      },
      setAll(lista) {
        try {
          lista.forEach(({ name, value, options }) => loja.set(name, value, options));
        } catch {
          // Chamado de uma página (só leitura): o proxy já renova a sessão.
        }
      },
    },
  });
}

"use server";

import { criarClienteServidor } from "@/lib/supabase/server";

/** Libera os convites pendentes do e-mail que acabou de entrar. */
export async function aceitarConvitesAgora(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.rpc("aceitar_convites");
}

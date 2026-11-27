import "server-only";
import { avisarSeguranca } from "./emails/seguranca";
import { criarClienteAdmin } from "./supabase/admin";

/** A entrada travou: avisa a dona ou o dono da conta por e-mail (só se a conta existe; quem digitou não fica sabendo). */
export async function avisarDeTrava(email: string): Promise<void> {
  const admin = criarClienteAdmin();
  if (!admin) return;
  try {
    const { data } = await admin.rpc("usuario_do_email", { p_email: email });
    if (data) await avisarSeguranca(email, "entrada-travada");
  } catch (e) {
    console.error("[aviso-de-trava]", e instanceof Error ? e.message : e);
  }
}

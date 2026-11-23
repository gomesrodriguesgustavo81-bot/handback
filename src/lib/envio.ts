import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { montarMensagem, remetenteComNome, type DadosEnvio } from "./emails/montar";
import { decifrar, enviarPeloGmail, ErroGmail, tokenDeAcesso } from "./gmail";
import { criarClienteAdmin } from "./supabase/admin";
import { origemDoSite } from "./acesso";

/** Gmail conectado de uma pessoa (só o e-mail; o token nunca sai do servidor). */
/** Nome que aparece nos e-mails e se a pessoa quer cópia das devolutivas (guardados na conta dela). */
export async function preferenciasDeEnvio(admin: SupabaseClient, userId: string): Promise<{ nome: string; email: string; copia: boolean }> {
  const { data } = await admin.auth.admin.getUserById(userId);
  const meta = (data.user?.user_metadata ?? {}) as { nome?: string; copia_devolutiva?: boolean };
  return { nome: String(meta.nome ?? "").trim(), email: data.user?.email ?? "", copia: meta.copia_devolutiva !== false };
}

export async function meuGmail(supabase: SupabaseClient): Promise<{ email: string; invalida: boolean } | null> {
  const { data } = await supabase.from("contas_gmail").select("email, invalida").maybeSingle();
  return data ?? null;
}

/**
 * Envia a devolutiva aprovada de uma entrega pelo Gmail da pessoa logada.
 * O banco confere a permissão, reserva o envio (não manda duas vezes) e
 * registra o resultado.
 */
export async function enviarDevolutiva(supabase: SupabaseClient, userId: string, entregaId: string): Promise<{ para: string[] }> {
  const admin = criarClienteAdmin();
  if (!admin) throw new ErroGmail("O envio ainda não foi configurado no servidor.");
  const { data: conta } = await admin.from("contas_gmail").select("email, token_cifrado, invalida").eq("user_id", userId).maybeSingle();
  if (!conta || conta.invalida) throw new ErroGmail("Conecte seu Gmail para enviar.", true);

  const { data: reserva, error } = await supabase.rpc("reservar_envio", { p_entrega: entregaId });
  if (error) throw new Error(error.message);
  try {
    // Sai com o nome da pessoa (não o da conta Google) e, se ela quiser, com cópia oculta para o e-mail dela.
    const eu = await preferenciasDeEnvio(admin, userId);
    const msg = montarMensagem(remetenteComNome(conta.email, eu.nome), { ...(reserva as DadosEnvio), site: await origemDoSite() }, undefined, eu.copia && eu.email ? [eu.email] : []);
    const id = await enviarPeloGmail(await tokenDeAcesso(decifrar(conta.token_cifrado)), msg.raw);
    const destino = [...msg.para, ...msg.copia];
    await supabase.rpc("concluir_envio", { p_entrega: entregaId, p_ok: true, p_de: conta.email, p_para: destino, p_id: id, p_erro: "" });
    return { para: destino };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    await supabase.rpc("concluir_envio", { p_entrega: entregaId, p_ok: false, p_de: "", p_para: [], p_id: "", p_erro: mensagem });
    if (e instanceof ErroGmail && e.reconectar) await admin.from("contas_gmail").update({ invalida: true }).eq("user_id", userId);
    throw e;
  }
}

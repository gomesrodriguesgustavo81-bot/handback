"use server";

import { revalidatePath } from "next/cache";
import { criarClienteServidor } from "@/lib/supabase/server";

const TIPOS = ["entrega", "ia", "prazo", "atraso", "enviada"] as const;

/** Salva uma preferência de aviso da própria pessoa. */
export async function salvarPreferencia(campo: string, valor: string): Promise<{ ok: boolean; mensagem: string }> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensagem: "Entre de novo." };
  const { data: atual } = await supabase.from("preferencias_avisos").select("resumo_email, celular, tipos").maybeSingle();
  const prefs = { resumo_email: atual?.resumo_email ?? true, celular: atual?.celular ?? false, tipos: (atual?.tipos as string[]) ?? ["entrega", "ia", "prazo", "atraso"] };
  const ligado = valor === "sim";
  if (campo === "resumo_email" || campo === "celular") prefs[campo] = ligado;
  else if (campo.startsWith("tipo_") && (TIPOS as readonly string[]).includes(campo.slice(5))) {
    const t = campo.slice(5);
    prefs.tipos = ligado ? [...new Set([...prefs.tipos, t])] : prefs.tipos.filter((x) => x !== t);
  } else return { ok: false, mensagem: "Campo desconhecido." };
  const { error } = await supabase.from("preferencias_avisos").upsert({ user_id: user.id, ...prefs, atualizado_em: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, mensagem: "Não foi possível salvar. Tente de novo." };
  revalidatePath("/conta/avisos");
  return { ok: true, mensagem: "Salvo." };
}

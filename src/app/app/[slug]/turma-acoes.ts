"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { contextoDaEmpresa } from "@/lib/empresa";
import { cookieDaTurma, turmaAtual, turmasDaEmpresa } from "@/lib/turma";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { pilotoDepois } from "@/lib/piloto";

/** Troca a turma mostrada (só para quem está trocando; fica guardada no navegador). */
export async function escolherTurma(slug: string, turmaId: string): Promise<void> {
  const { empresa } = await contextoDaEmpresa(slug);
  const turmas = await turmasDaEmpresa(empresa.id);
  if (!turmas.some((t) => t.id === turmaId)) return;
  (await cookies()).set(cookieDaTurma(empresa.id), turmaId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath(`/app/${slug}`, "layout");
}

/** Guarda que a mensagem com o endereço foi copiada (um dos primeiros passos). */
export async function marcarMensagemCopiada(slug: string): Promise<void> {
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return;
  const turma = await turmaAtual(empresa.id);
  const admin = criarClienteAdmin();
  if (!turma || !admin) return;
  await admin.from("turmas").update({ mensagem_copiada_em: new Date().toISOString() }).eq("id", turma.id).eq("org_id", empresa.id).is("mensagem_copiada_em", null);
}

/** Liga ou desliga o piloto automático da turma aberta (o que chega já vai para a IA). */
export async function ligarPiloto(slug: string, ligar: boolean): Promise<void> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return;
  const turma = await turmaAtual(empresa.id);
  if (!turma) return;
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("ligar_piloto", { p_turma: turma.id, p_ligar: ligar });
  if (error) throw new Error(error.message);
  // Ao ligar, o que já está esperando entra na fila na hora.
  if (ligar) {
    const admin = criarClienteAdmin();
    if (admin) {
      await pilotoDepois(admin);
    }
  }
  revalidatePath(`/app/${slug}`, "layout");
}

"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { levarParaODrive } from "@/lib/drive";
import { contextoDaEmpresa } from "@/lib/empresa";
import { decifrar, revogar } from "@/lib/gmail";
import { registrarAcesso } from "@/lib/registro";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";

type R = { ok: boolean; mensagem: string };

async function contexto(slug: string) {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return null;
  const turma = await turmaAtual(empresa.id);
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = criarClienteAdmin();
  if (!turma || !user || !admin) return null;
  return { empresa, turma, user, admin };
}

/** Leva os arquivos que esperam para o Drive, depois de responder (sem segurar a tela). */
function levarDepois() {
  after(async () => {
    const admin = criarClienteAdmin();
    if (admin) await levarParaODrive(admin, Date.now() + 40_000).catch(() => undefined);
  });
}

export async function ligarDrive(slug: string, ligar: boolean): Promise<R> {
  const c = await contexto(slug);
  if (!c) return { ok: false, mensagem: "Só quem administra pode mudar isso." };
  if (!ligar) {
    await c.admin.from("turmas").update({ drive_por: null, drive_erro: "" }).eq("id", c.turma.id).eq("org_id", c.empresa.id);
    revalidatePath(`/app/${slug}/configuracoes/drive`);
    return { ok: true, mensagem: "Desligado. As entregas novas ficam no Handback; as que já estão no Drive continuam lá." };
  }
  const { data: con } = await c.admin.from("conexoes_google").select("invalida").eq("user_id", c.user.id).eq("servico", "drive").maybeSingle();
  if (!con || con.invalida) return { ok: false, mensagem: "Conecte o seu Google Drive primeiro." };
  await c.admin
    .from("turmas")
    .update({ drive_por: c.user.id, drive_desde: new Date().toISOString(), drive_erro: "" })
    .eq("id", c.turma.id)
    .eq("org_id", c.empresa.id);
  levarDepois();
  revalidatePath(`/app/${slug}/configuracoes/drive`);
  return { ok: true, mensagem: "Ligado. Os arquivos das entregas vão para a pasta Handback do seu Drive." };
}

export async function salvarAntigos(slug: string, mover: boolean): Promise<R> {
  const c = await contexto(slug);
  if (!c) return { ok: false, mensagem: "Só quem administra pode mudar isso." };
  await c.admin.from("turmas").update({ drive_antigos: mover }).eq("id", c.turma.id).eq("org_id", c.empresa.id);
  if (mover) levarDepois();
  revalidatePath(`/app/${slug}/configuracoes/drive`);
  return { ok: true, mensagem: mover ? "Os arquivos antigos vão para o Drive aos poucos." : "Os arquivos antigos ficam no Handback." };
}

export async function levarAgora(slug: string): Promise<void> {
  const c = await contexto(slug);
  if (!c) return;
  await levarParaODrive(c.admin, Date.now() + 40_000);
  revalidatePath(`/app/${slug}/configuracoes/drive`);
}

/** Desconecta o Google Drive de quem está logado. Os arquivos continuam no Drive da pessoa. */
export async function desconectarDrive(slug: string): Promise<void> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = criarClienteAdmin();
  if (!user || !admin) return;
  const { data } = await admin.from("conexoes_google").select("token_cifrado").eq("user_id", user.id).eq("servico", "drive").maybeSingle();
  if (data) {
    try {
      await revogar(decifrar(data.token_cifrado));
    } catch {
      /* some do Handback de qualquer jeito */
    }
    await admin.from("conexoes_google").delete().eq("user_id", user.id).eq("servico", "drive");
    await admin.from("turmas").update({ drive_por: null }).eq("drive_por", user.id);
    await admin.from("drive_pastas").delete().eq("user_id", user.id);
    await registrarAcesso(supabase, "desconectou_drive");
  }
  revalidatePath(`/app/${slug}/configuracoes/drive`);
}

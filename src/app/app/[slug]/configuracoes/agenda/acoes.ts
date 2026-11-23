"use server";

import { revalidatePath } from "next/cache";
import { origemDoSite } from "@/lib/acesso";
import { apagarAgendaDaTurma, sincronizarAgenda } from "@/lib/agenda";
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
  return { empresa, turma, user, admin, supabase };
}

/** Liga a agenda da turma na conta de quem está logado (ou desliga e apaga a agenda criada). */
export async function ligarAgenda(slug: string, ligar: boolean): Promise<R> {
  const c = await contexto(slug);
  if (!c) return { ok: false, mensagem: "Só quem administra pode mudar isso." };
  if (!ligar) {
    await apagarAgendaDaTurma(c.admin, c.turma.id);
    revalidatePath(`/app/${slug}/configuracoes/agenda`);
    return { ok: true, mensagem: "Agenda desligada e apagada da sua conta Google." };
  }
  const { data: con } = await c.admin.from("conexoes_google").select("invalida").eq("user_id", c.user.id).eq("servico", "agenda").maybeSingle();
  if (!con || con.invalida) return { ok: false, mensagem: "Conecte o seu Google Agenda primeiro." };
  const { data: t } = await c.admin.from("turmas").select("agenda_por").eq("id", c.turma.id).single();
  // Passou para outra pessoa: a agenda antiga sai da conta de quem tinha.
  if (t?.agenda_por && t.agenda_por !== c.user.id) await apagarAgendaDaTurma(c.admin, c.turma.id);
  await c.admin.from("turmas").update({ agenda_por: c.user.id }).eq("id", c.turma.id).eq("org_id", c.empresa.id);
  const r = await sincronizarAgenda(c.admin, c.turma.id, await origemDoSite());
  revalidatePath(`/app/${slug}/configuracoes/agenda`);
  return r.ok
    ? { ok: true, mensagem: `Agenda criada na sua conta Google${r.criados ? ` com ${r.criados} ${r.criados === 1 ? "evento" : "eventos"}` : ""}.` }
    : { ok: false, mensagem: `Não deu certo: ${r.mensagem}` };
}

/** O que entra na agenda (prazo, abre, dia da aula) e se os alunos são convidados. */
export async function salvarAgenda(slug: string, campo: string, valor: string): Promise<R> {
  const c = await contexto(slug);
  if (!c) return { ok: false, mensagem: "Só quem administra pode mudar isso." };
  const { data: t } = await c.admin.from("turmas").select("agenda_itens").eq("id", c.turma.id).single();
  const itens = new Set((t?.agenda_itens as string[]) ?? []);
  let mudanca: Record<string, unknown>;
  if (campo === "convidar") mudanca = { agenda_convidar: valor === "sim" };
  else if (["prazo", "abre", "aula"].includes(campo)) {
    if (valor === "sim") itens.add(campo);
    else itens.delete(campo);
    mudanca = { agenda_itens: [...itens] };
  } else return { ok: false, mensagem: "Campo desconhecido." };
  const { error } = await c.supabase.from("turmas").update(mudanca).eq("id", c.turma.id).eq("org_id", c.empresa.id);
  if (error) return { ok: false, mensagem: "Não foi possível salvar. Tente de novo." };
  const r = await sincronizarAgenda(c.admin, c.turma.id, await origemDoSite());
  revalidatePath(`/app/${slug}/configuracoes/agenda`);
  return r.ok || r.mensagem === "agenda desligada" ? { ok: true, mensagem: "Salvo." } : { ok: false, mensagem: `Salvo, mas a agenda não atualizou: ${r.mensagem}` };
}

export async function atualizarAgendaAgora(slug: string): Promise<void> {
  const c = await contexto(slug);
  if (!c) return;
  await sincronizarAgenda(c.admin, c.turma.id, await origemDoSite());
  revalidatePath(`/app/${slug}/configuracoes/agenda`);
}

/** Desconecta o Google Agenda de quem está logado (as agendas que já existem ficam na conta da pessoa). */
export async function desconectarAgenda(slug: string): Promise<void> {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = criarClienteAdmin();
  if (!user || !admin) return;
  const { data } = await admin.from("conexoes_google").select("token_cifrado").eq("user_id", user.id).eq("servico", "agenda").maybeSingle();
  if (data) {
    try {
      await revogar(decifrar(data.token_cifrado));
    } catch {
      /* some do Handback de qualquer jeito */
    }
    await admin.from("conexoes_google").delete().eq("user_id", user.id).eq("servico", "agenda");
    await admin.from("turmas").update({ agenda_por: null, agenda_id: null, agenda_em: null }).eq("agenda_por", user.id);
    await registrarAcesso(supabase, "desconectou_agenda");
  }
  revalidatePath(`/app/${slug}/configuracoes/agenda`);
}

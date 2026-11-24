"use server";

import { revalidatePath } from "next/cache";
import { ErroClassroom, meusCursos } from "@/lib/classroom/cliente";
import {
  acessoDoClassroom,
  devolverNoClassroom,
  publicarNoClassroom,
  sincronizarClassroom,
  trazerArquivosEscolhidos,
  type ResultadoClassroom,
} from "@/lib/classroom/sincronizar";
import { contextoDaEmpresa } from "@/lib/empresa";
import { decifrar, revogar } from "@/lib/gmail";
import { registrarAcesso } from "@/lib/registro";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";

type R = { ok: boolean; mensagem: string; reconectar?: boolean };

function falha(e: unknown, padrao: string): R {
  if (e instanceof ErroClassroom) return { ok: false, mensagem: e.message, reconectar: e.reconectar };
  console.error("[classroom]", e);
  return { ok: false, mensagem: padrao };
}

async function eu() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user, admin: criarClienteAdmin() };
}

async function contexto(slug: string) {
  const { empresa, podeGerir, podeAvaliar } = await contextoDaEmpresa(slug);
  const turma = await turmaAtual(empresa.id);
  const { supabase, user, admin } = await eu();
  if (!turma || !user || !admin) return null;
  return { empresa, turma, user, admin, supabase, podeGerir, podeAvaliar };
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

function resumoDaBusca(r: ResultadoClassroom): string {
  return `${plural(r.alunos, "aluno", "alunos")}, ${plural(r.tarefas, "tarefa", "tarefas")} e ${plural(r.novas, "entrega nova", "entregas novas")}${r.faltam ? ` (mais ${r.faltam} na próxima busca)` : ""}.`;
}

/** Liga a turma atual do Handback a uma turma do Classroom e já traz tudo. */
export async function ligarClassroom(slug: string, cursoId: string): Promise<R> {
  const c = await contexto(slug);
  if (!c?.podeGerir) return { ok: false, mensagem: "Só quem administra pode ligar o Classroom." };
  const a = await acessoDoClassroom(c.admin, c.user.id);
  if (!a) return { ok: false, mensagem: "Conecte o seu Google Classroom primeiro.", reconectar: true };
  try {
    const curso = (await meusCursos(a.acesso)).find((x) => x.id === cursoId);
    if (!curso) return { ok: false, mensagem: "Essa turma não apareceu no seu Classroom. Atualize a página e escolha de novo." };
    const nome = [curso.name, curso.section].filter(Boolean).join(" · ").slice(0, 300);
    const { error } = await c.admin
      .from("turmas")
      .update({ classroom_curso: curso.id, classroom_curso_nome: nome, classroom_por: c.user.id, classroom_buscado_em: null, classroom_erro: "" })
      .eq("id", c.turma.id)
      .eq("org_id", c.empresa.id);
    if (error) {
      return { ok: false, mensagem: error.code === "23505" ? "Essa turma do Classroom já está ligada a outra turma sua." : "Não foi possível ligar. Tente de novo." };
    }
    const r = await sincronizarClassroom(c.admin, c.turma.id, 0);
    revalidatePath(`/app/${slug}`, "layout");
    return { ok: true, mensagem: r ? `Ligada. Chegaram ${resumoDaBusca(r)}` : "Ligada." };
  } catch (e) {
    revalidatePath(`/app/${slug}`, "layout");
    return falha(e, "Ligada, mas a primeira busca falhou. Toque em Buscar agora.");
  }
}

/** Desliga a turma do Classroom. Os ciclos, alunos e entregas que já vieram ficam. */
export async function desligarClassroom(slug: string): Promise<R> {
  const c = await contexto(slug);
  if (!c?.podeGerir) return { ok: false, mensagem: "Só quem administra pode desligar." };
  await c.admin
    .from("turmas")
    .update({ classroom_curso: null, classroom_curso_nome: "", classroom_por: null, classroom_erro: "" })
    .eq("id", c.turma.id)
    .eq("org_id", c.empresa.id);
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: "Desligada. O que já veio do Classroom continua aqui." };
}

/** Busca agora as novidades do Classroom da turma atual. */
export async function buscarNoClassroom(slug: string): Promise<R> {
  const c = await contexto(slug);
  if (!c?.podeAvaliar) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  try {
    const r = await sincronizarClassroom(c.admin, c.turma.id, 10);
    revalidatePath(`/app/${slug}`, "layout");
    return r ? { ok: true, mensagem: `Pronto: ${resumoDaBusca(r)}` } : { ok: true, mensagem: "Acabou de buscar. Tente de novo em alguns segundos." };
  } catch (e) {
    revalidatePath(`/app/${slug}`, "layout");
    return falha(e, "Não foi possível buscar no Classroom. Tente de novo.");
  }
}

/** Desconecta o Google Classroom de quem está logado (e desliga as turmas que dependiam dessa conexão). */
export async function desconectarClassroom(slug: string): Promise<void> {
  const { supabase, user, admin } = await eu();
  if (!user || !admin) return;
  const { data } = await admin.from("conexoes_google").select("token_cifrado").eq("user_id", user.id).eq("servico", "classroom").maybeSingle();
  if (data) {
    try {
      await revogar(decifrar(data.token_cifrado));
    } catch {
      /* some do Handback de qualquer jeito */
    }
    await admin.from("conexoes_google").delete().eq("user_id", user.id).eq("servico", "classroom");
    await admin.from("turmas").update({ classroom_curso: null, classroom_curso_nome: "", classroom_por: null }).eq("classroom_por", user.id);
    await registrarAcesso(supabase, "desconectou_classroom");
  }
  revalidatePath(`/app/${slug}`, "layout");
}

export type Escolha =
  | { ok: true; acesso: string; chave: string; app: string; ids: string[]; simular: boolean }
  | { ok: false; mensagem: string; reconectar?: boolean };

/**
 * O que a janela do Google precisa para mostrar os arquivos deste ciclo:
 * um acesso de curta duração do próprio professor e os arquivos esperando.
 */
export async function prepararEscolha(slug: string, etapaId: string): Promise<Escolha> {
  const c = await contexto(slug);
  if (!c?.podeAvaliar) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  if (c.turma.classroom_por !== c.user.id) return { ok: false, mensagem: "Só quem ligou esta turma ao Classroom pode trazer os arquivos." };
  const simular = Boolean(process.env.HANDBACK_GOOGLE_BASE);
  const chave = process.env.GOOGLE_PICKER_CHAVE ?? "";
  const app = process.env.GOOGLE_PROJETO_NUMERO ?? "";
  if (!simular && (!chave || !app)) return { ok: false, mensagem: "A janela de escolher arquivos do Google ainda não foi configurada no servidor." };
  const { data: pendentes } = await c.supabase.from("classroom_pendentes").select("drive_id").eq("etapa_id", etapaId).limit(500);
  const ids = [...new Set((pendentes ?? []).map((p) => String(p.drive_id)))];
  if (!ids.length) return { ok: false, mensagem: "Nenhum arquivo esperando neste ciclo." };
  const a = await acessoDoClassroom(c.admin, c.user.id);
  if (!a) return { ok: false, mensagem: "A conexão com o Google Classroom expirou. Conecte de novo.", reconectar: true };
  return { ok: true, acesso: a.acesso, chave, app, ids, simular };
}

/** Baixa os arquivos escolhidos na janela do Google (em lotes pequenos). */
export async function trazerArquivos(slug: string, etapaId: string, ids: string[]): Promise<R & { trazidos?: number; erros?: string[] }> {
  const c = await contexto(slug);
  if (!c?.podeAvaliar) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const limpos = ids.filter((x) => typeof x === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(x)).slice(0, 10);
  try {
    const { data: etapa } = await c.supabase.from("etapas").select("id").eq("id", etapaId).eq("turma_id", c.turma.id).maybeSingle();
    if (!etapa) return { ok: false, mensagem: "Ciclo não encontrado." };
    const r = await trazerArquivosEscolhidos(c.admin, etapaId, c.user.id, limpos);
    return { ok: true, mensagem: "", ...r };
  } catch (e) {
    return falha(e, "Não foi possível trazer os arquivos. Tente de novo.");
  } finally {
    revalidatePath(`/app/${slug}`, "layout");
  }
}

/** Cria a tarefa deste ciclo no Classroom. */
export async function publicarCiclo(slug: string, etapaId: string): Promise<R> {
  const c = await contexto(slug);
  if (!c?.podeGerir) return { ok: false, mensagem: "Só quem administra pode publicar no Classroom." };
  try {
    const { data: etapa } = await c.supabase.from("etapas").select("id").eq("id", etapaId).eq("turma_id", c.turma.id).maybeSingle();
    if (!etapa) return { ok: false, mensagem: "Ciclo não encontrado." };
    await publicarNoClassroom(c.admin, etapaId, c.user.id);
    revalidatePath(`/app/${slug}`, "layout");
    return { ok: true, mensagem: "Publicada no Classroom. Os alunos já veem a tarefa lá." };
  } catch (e) {
    return falha(e, "Não foi possível publicar no Classroom. Tente de novo.");
  }
}

/** Lança no Classroom a nota da devolutiva aprovada e devolve o trabalho ao aluno. */
export async function devolverNoClassroomAcao(slug: string, entregaId: string): Promise<R> {
  const { podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const { supabase, admin } = await eu();
  if (!admin) return { ok: false, mensagem: "O servidor ainda não está pronto. Avise o suporte." };
  try {
    const { nota, alunos } = await devolverNoClassroom(supabase, admin, entregaId);
    return { ok: true, mensagem: `Nota ${String(nota).replace(".", ",")} lançada no Classroom${alunos > 1 ? ` para ${alunos} alunos` : ""}.` };
  } catch (e) {
    return falha(e, "Não foi possível lançar a nota no Classroom. Tente de novo.");
  } finally {
    revalidatePath(`/app/${slug}`, "layout");
  }
}

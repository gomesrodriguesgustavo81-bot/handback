import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decifrar, ErroGmail, tokenDeAcesso } from "../gmail";
import { notaDoConceito } from "../moodle/cliente";
import { despacharPush } from "../push";
import { levarParaODrive } from "../drive";
import { emailValido, nomeArquivoSeguro } from "../textos";
import {
  alunos as alunosDoCurso,
  apagarTarefa,
  baixarDoDrive,
  criarTarefa,
  entregueEm,
  envios as enviosDaTarefa,
  ErroClassroom,
  lancarNota,
  prazoDaTarefa,
  tarefas as tarefasDoCurso,
  type AlunoClassroom,
} from "./cliente";

/** Quantas entregas novas, no máximo, cada busca grava (o resto vem na próxima). */
const POR_BUSCA = 150;
const NOTA_MAX_PADRAO = 10;

/** Token de acesso do Classroom de uma pessoa (null se não conectou ou expirou). */
export async function acessoDoClassroom(admin: SupabaseClient, userId: string): Promise<{ email: string; acesso: string } | null> {
  const { data } = await admin.from("conexoes_google").select("email, token_cifrado, invalida").eq("user_id", userId).eq("servico", "classroom").maybeSingle();
  if (!data || data.invalida) return null;
  try {
    return { email: data.email, acesso: await tokenDeAcesso(decifrar(data.token_cifrado)) };
  } catch (e) {
    if (e instanceof ErroGmail && e.reconectar) await admin.from("conexoes_google").update({ invalida: true }).eq("user_id", userId).eq("servico", "classroom");
    return null;
  }
}

async function acessoOuErro(admin: SupabaseClient, userId: string | null) {
  const a = userId ? await acessoDoClassroom(admin, userId) : null;
  if (!a) throw new ErroClassroom("A conexão com o Google Classroom expirou ou foi desligada. Conecte de novo em Google Classroom.", 401, true);
  return a.acesso;
}

type Turma = { id: string; org_id: string; classroom_curso: string; classroom_por: string | null };

const emailDe = (a: AlunoClassroom) => (a.profile?.emailAddress ?? "").trim().toLowerCase();

/**
 * Alunos do Classroom: quem já está numa equipe do Handback (pelo e-mail)
 * fica onde está; quem não está vira um cadastro individual. Devolve onde
 * cada aluno (id do Classroom) entrega.
 */
async function atualizarPessoas(admin: SupabaseClient, t: Turma, lista: AlunoClassroom[]): Promise<Map<string, string>> {
  const [{ data: cadastrados }, { data: grupos }] = await Promise.all([
    admin.from("integrantes").select("email, grupo_id, grupos!inner(escondido)").eq("turma_id", t.id).eq("grupos.escondido", false),
    admin.from("grupos").select("id, nome, classroom_aluno").eq("turma_id", t.id),
  ]);
  const porEmail = new Map((cadastrados ?? []).map((i) => [String(i.email), String(i.grupo_id)]));
  const porAluno = new Map((grupos ?? []).filter((g) => g.classroom_aluno).map((g) => [String(g.classroom_aluno), String(g.id)]));
  const nomes = new Set((grupos ?? []).map((g) => String(g.nome).trim().toLowerCase()));
  const onde = new Map<string, string>();
  const novos: { org_id: string; turma_id: string; grupo_id: string; email: string; nome: string }[] = [];

  for (const a of lista) {
    const email = emailDe(a);
    const nome = (a.profile?.name?.fullName ?? "").trim().slice(0, 200);
    const jaEsta = email ? porEmail.get(email) : undefined;
    if (jaEsta) {
      onde.set(a.userId, jaEsta);
      continue;
    }
    let grupo = porAluno.get(a.userId);
    if (!grupo) {
      const base = (nome || email.split("@")[0] || `Aluno ${a.userId}`).slice(0, 110);
      let nomeGrupo = base;
      for (let n = 2; nomes.has(nomeGrupo.toLowerCase()); n++) nomeGrupo = `${base} (${n})`;
      nomes.add(nomeGrupo.toLowerCase());
      grupo = randomUUID();
      const { error } = await admin.from("grupos").insert({ id: grupo, org_id: t.org_id, turma_id: t.id, nome: nomeGrupo, classroom_aluno: a.userId });
      if (error) {
        if (error.code !== "23505") throw new Error(`Não foi possível cadastrar ${nomeGrupo}: ${error.message}`);
        const { data: outro } = await admin.from("grupos").select("id").eq("turma_id", t.id).eq("classroom_aluno", a.userId).maybeSingle();
        if (!outro) continue;
        grupo = String(outro.id);
      }
      porAluno.set(a.userId, grupo);
    }
    onde.set(a.userId, grupo);
    if (email && emailValido(email)) novos.push({ org_id: t.org_id, turma_id: t.id, grupo_id: grupo, email, nome });
  }
  if (novos.length) await admin.from("integrantes").upsert(novos, { onConflict: "turma_id,email", ignoreDuplicates: true });
  return onde;
}

/** Cada tarefa do Classroom vira um ciclo (as que já viraram só são atualizadas). */
async function atualizarTarefas(admin: SupabaseClient, t: Turma, acesso: string) {
  const lista = (await tarefasDoCurso(acesso, t.classroom_curso)).sort(
    (a, b) => (prazoDaTarefa(a) ?? "9999").localeCompare(prazoDaTarefa(b) ?? "9999") || String(a.creationTime).localeCompare(String(b.creationTime)),
  );
  const [{ data: etapas }, { data: ignoradas }] = await Promise.all([
    admin.from("etapas").select("id, numero, classroom_tarefa").eq("turma_id", t.id),
    admin.from("classroom_ignoradas").select("tarefa").eq("turma_id", t.id),
  ]);
  const fora = new Set((ignoradas ?? []).map((x) => String(x.tarefa)));
  const porTarefa = new Map((etapas ?? []).filter((e) => e.classroom_tarefa).map((e) => [String(e.classroom_tarefa), String(e.id)]));
  let numero = Math.max(0, ...(etapas ?? []).map((e) => Number(e.numero)));
  for (const tarefa of lista) {
    const extra = {
      classroom_nosso: Boolean(tarefa.associatedWithDeveloper),
      classroom_nota_max: tarefa.maxPoints && tarefa.maxPoints > 0 ? tarefa.maxPoints : null,
      classroom_link: (tarefa.alternateLink ?? "").slice(0, 500),
    };
    const existente = porTarefa.get(tarefa.id);
    if (!existente && fora.has(tarefa.id)) continue; // o professor apagou este ciclo no Handback
    if (existente) {
      await admin.from("etapas").update(extra).eq("id", existente);
      continue;
    }
    const prazo = prazoDaTarefa(tarefa);
    const titulo = (tarefa.title ?? "").trim().slice(0, 200);
    const { error } = await admin.from("etapas").insert({
      org_id: t.org_id,
      turma_id: t.id,
      numero: ++numero,
      titulo: titulo.length >= 2 ? titulo : `Tarefa ${tarefa.id}`,
      data: prazo,
      recebe_ate: prazo,
      criterios: (tarefa.description ?? "").slice(0, 5000),
      classroom_tarefa: tarefa.id,
      ...extra,
    });
    if (error && error.code !== "23505") throw new Error(`Não foi possível criar a entrega ${titulo}: ${error.message}`);
  }
  return lista.length;
}

/** Envios novos viram entregas. Links e respostas já chegam; arquivos do Drive esperam o professor escolher. */
async function trazerEntregas(admin: SupabaseClient, t: Turma, acesso: string, onde: Map<string, string>, lista: AlunoClassroom[]) {
  const { data: etapas } = await admin.from("etapas").select("id, titulo, classroom_tarefa").eq("turma_id", t.id).not("classroom_tarefa", "is", null);
  const email = new Map(lista.map((a) => [a.userId, emailDe(a) || (a.profile?.name?.fullName ?? "")]));
  let novas = 0;
  let faltam = 0;
  for (const etapa of etapas ?? []) {
    const lista = (await enviosDaTarefa(acesso, t.classroom_curso, String(etapa.classroom_tarefa))).sort((a, b) => entregueEm(a).localeCompare(entregueEm(b)));
    if (!lista.length) continue;
    const { data: ja } = await admin.from("entregas").select("classroom_chave").eq("etapa_id", etapa.id).not("classroom_chave", "is", null);
    const jaTem = new Set((ja ?? []).map((x) => String(x.classroom_chave)));
    for (const s of lista) {
      const quando = entregueEm(s);
      const chave = `${s.id}:${quando}`;
      if (jaTem.has(chave)) continue;
      const grupo = onde.get(s.userId);
      if (!grupo) continue; // não é aluno da turma
      const anexos = s.assignmentSubmission?.attachments ?? [];
      const arquivos = anexos.filter((a) => a.driveFile?.id).map((a) => ({ id: a.driveFile!.id, nome: a.driveFile!.title ?? "" }));
      const links = anexos
        .map((a) => a.link?.url ?? a.youTubeVideo?.alternateLink ?? a.form?.formUrl ?? "")
        .filter((u) => /^https?:\/\//.test(u))
        .slice(0, 50);
      const texto = [s.shortAnswerSubmission?.answer, s.multipleChoiceSubmission?.answer].filter(Boolean).join("\n\n");
      if (!arquivos.length && !links.length && !texto) continue;
      if (novas >= POR_BUSCA) {
        faltam++;
        continue;
      }
      const { error } = await admin.rpc("gravar_entrega_classroom", {
        p_id: randomUUID(),
        p_org: t.org_id,
        p_etapa: etapa.id,
        p_grupo: grupo,
        p_remetente: (email.get(s.userId) ?? "").slice(0, 300),
        p_assunto: `Classroom · ${etapa.titulo}`,
        p_enviada_em: quando,
        p_comentario: texto.slice(0, 20000),
        p_links: links,
        p_pendentes: arquivos.slice(0, 20),
        p_chave: chave,
        p_envio: s.id,
      });
      if (error) {
        if (error.code === "23505") continue; // outra busca gravou ao mesmo tempo
        throw new Error(`Falha ao gravar a entrega: ${error.message}`);
      }
      jaTem.add(chave);
      novas++;
    }
  }
  return { novas, faltam };
}

export type ResultadoClassroom = { novas: number; faltam: number; alunos: number; tarefas: number };

/**
 * Traz do Classroom os alunos, as tarefas e as entregas novas da turma.
 * "segundos" evita duas buscas ao mesmo tempo (devolve null se buscou há pouco).
 */
export async function sincronizarClassroom(admin: SupabaseClient, turmaId: string, segundos = 20): Promise<ResultadoClassroom | null> {
  const desde = new Date(Date.now() - segundos * 1000).toISOString();
  const { data: reservada } = await admin
    .from("turmas")
    .update({ classroom_buscado_em: new Date().toISOString() })
    .eq("id", turmaId)
    .not("classroom_curso", "is", null)
    .or(`classroom_buscado_em.is.null,classroom_buscado_em.lt.${desde}`)
    .select("id, org_id, classroom_curso, classroom_por")
    .maybeSingle();
  if (!reservada) return null;
  const t = reservada as Turma;
  try {
    const acesso = await acessoOuErro(admin, t.classroom_por);
    const lista = await alunosDoCurso(acesso, t.classroom_curso);
    const onde = await atualizarPessoas(admin, t, lista);
    const tarefas = await atualizarTarefas(admin, t, acesso);
    const r = await trazerEntregas(admin, t, acesso, onde, lista);
    await admin.from("turmas").update({ classroom_erro: "" }).eq("id", t.id);
    if (r.novas) await despacharPush(admin).catch(() => 0);
    return { ...r, alunos: lista.length, tarefas };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    await admin.from("turmas").update({ classroom_erro: mensagem.slice(0, 500) }).eq("id", t.id);
    throw e;
  }
}

/**
 * Baixa os arquivos que o professor escolheu na janela do Google. Só os que
 * estão esperando neste ciclo; o resto é ignorado.
 */
export async function trazerArquivosEscolhidos(
  admin: SupabaseClient,
  etapaId: string,
  userId: string,
  driveIds: string[],
): Promise<{ trazidos: number; erros: string[] }> {
  const { data: etapa } = await admin.from("etapas").select("id, turmas!inner(classroom_por)").eq("id", etapaId).maybeSingle();
  const dono = (etapa?.turmas as unknown as { classroom_por: string | null } | null)?.classroom_por;
  if (!etapa || dono !== userId) throw new ErroClassroom("Só quem ligou esta turma ao Classroom pode trazer os arquivos.");
  const acesso = await acessoOuErro(admin, userId);
  const { data: pendentes } = await admin
    .from("classroom_pendentes")
    .select("entrega_id, drive_id, org_id, nome")
    .eq("etapa_id", etapaId)
    .in("drive_id", [...new Set(driveIds)].slice(0, 50));
  let trazidos = 0;
  const erros: string[] = [];
  for (const [i, p] of (pendentes ?? []).entries()) {
    try {
      const a = await baixarDoDrive(acesso, p.drive_id);
      const caminho = `${p.org_id}/classroom/${p.entrega_id}/${Date.now().toString(36)}${i}-${nomeArquivoSeguro(a.nome)}`;
      const { error } = await admin.storage.from("entregas").upload(caminho, a.dados, { contentType: a.tipo, upsert: false });
      if (error) throw new Error(error.message);
      const { error: e2 } = await admin.rpc("guardar_arquivo_classroom", {
        p_entrega: p.entrega_id,
        p_drive: p.drive_id,
        p_caminho: caminho,
        p_nome: a.nome.slice(0, 300),
        p_tamanho: a.dados.length,
        p_tipo: a.tipo,
      });
      if (e2) {
        await admin.storage.from("entregas").remove([caminho]);
        throw new Error(e2.message);
      }
      trazidos++;
    } catch (e) {
      if (e instanceof ErroClassroom && e.reconectar) throw e;
      erros.push(`${p.nome || "arquivo"}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (trazidos) await levarParaODrive(admin, Date.now() + 15_000).catch(() => undefined);
  return { trazidos, erros };
}

/** Cria no Classroom a tarefa de um ciclo (assim o Handback pode lançar as notas dela). */
export async function publicarNoClassroom(admin: SupabaseClient, etapaId: string, userId: string): Promise<{ link: string }> {
  const { data: e } = await admin
    .from("etapas")
    .select("id, titulo, numero, recebe_ate, entregaveis, criterios, classroom_tarefa, turmas!inner(classroom_curso, classroom_por)")
    .eq("id", etapaId)
    .maybeSingle();
  if (!e) throw new ErroClassroom("Entrega não encontrada.");
  const t = e.turmas as unknown as { classroom_curso: string | null; classroom_por: string | null };
  if (!t.classroom_curso) throw new ErroClassroom("Esta turma não está ligada ao Classroom.");
  if (t.classroom_por !== userId) throw new ErroClassroom("Só quem ligou esta turma ao Classroom pode publicar nela.");
  if (e.classroom_tarefa) throw new ErroClassroom("Esta entrega já está no Classroom.");
  const acesso = await acessoOuErro(admin, userId);
  const itens = ((e.entregaveis as string[] | null) ?? []).filter(Boolean);
  const descricao = [
    itens.length ? `O que entregar:\n${itens.map((i) => `• ${i}`).join("\n")}` : "",
    String(e.criterios ?? "").trim() ? `Critérios:\n${String(e.criterios).trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const nova = await criarTarefa(acesso, t.classroom_curso, { titulo: e.titulo, descricao, prazo: e.recebe_ate, notaMax: NOTA_MAX_PADRAO });
  const link = (nova.alternateLink ?? "").slice(0, 500);
  const { error } = await admin
    .from("etapas")
    .update({ classroom_tarefa: nova.id, classroom_nosso: true, classroom_nota_max: nova.maxPoints ?? NOTA_MAX_PADRAO, classroom_link: link })
    .eq("id", etapaId)
    .is("classroom_tarefa", null);
  if (error) throw new ErroClassroom(`A tarefa foi criada no Classroom, mas não deu para guardar aqui (${error.message}).`);
  return { link };
}

/**
 * Antes de apagar um ciclo: se a tarefa foi criada pelo Handback no
 * Classroom, apaga lá também. Tarefa criada à mão no Classroom fica lá.
 */
export async function apagarNoClassroom(admin: SupabaseClient, etapaId: string, userId: string): Promise<void> {
  const { data: e } = await admin.from("etapas").select("classroom_tarefa, classroom_nosso, turmas!inner(classroom_curso, classroom_por)").eq("id", etapaId).maybeSingle();
  const t = e?.turmas as unknown as { classroom_curso: string | null; classroom_por: string | null } | undefined;
  if (!e?.classroom_tarefa || !e.classroom_nosso || !t?.classroom_curso) return;
  if (t.classroom_por !== userId) throw new ErroClassroom("Só quem ligou esta turma ao Classroom pode apagar esta entrega (a tarefa também sai do Classroom).");
  await apagarTarefa(await acessoOuErro(admin, userId), t.classroom_curso, e.classroom_tarefa);
}

/** Lança no Classroom a nota da devolutiva aprovada (para cada aluno da equipe que entregou) e devolve o trabalho. */
export async function devolverNoClassroom(supabase: SupabaseClient, admin: SupabaseClient, entregaId: string): Promise<{ nota: number; alunos: number }> {
  const { data, error } = await supabase.rpc("reservar_envio_classroom", { p_entrega: entregaId });
  if (error) throw new ErroClassroom(error.message);
  const r = data as { por: string; curso: string; tarefa: string; nota_max: number | null; envio: string | null; emails: string[]; conceito: string | null; porcentagem: number | null };
  try {
    const nota = notaDoConceito(r.nota_max, r.porcentagem);
    if (nota === null) throw new ErroClassroom("Este conceito ainda não tem nota. Escolha um conceito ou ajuste as notas em Configurações › Avaliação.");
    const acesso = await acessoOuErro(admin, r.por);
    const [lista, roster] = await Promise.all([enviosDaTarefa(acesso, r.curso, r.tarefa), alunosDoCurso(acesso, r.curso)]);
    const daEquipe = new Set(r.emails);
    const emailDoAluno = new Map(roster.map((a) => [a.userId, emailDe(a)]));
    const alvos = lista.filter((s) => s.id === r.envio || daEquipe.has(emailDoAluno.get(s.userId) ?? ""));
    if (!alvos.length) throw new ErroClassroom("Não achamos esta entrega no Classroom. Busque as entregas de novo.");
    for (const s of alvos) await lancarNota(acesso, r.curso, r.tarefa, s.id, nota);
    await supabase.rpc("concluir_envio_classroom", { p_entrega: entregaId, p_ok: true, p_nota: nota, p_erro: "" });
    return { nota, alunos: alvos.length };
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : String(e);
    await supabase.rpc("concluir_envio_classroom", { p_entrega: entregaId, p_ok: false, p_nota: null, p_erro: mensagem });
    throw e;
  }
}

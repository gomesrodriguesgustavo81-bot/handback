"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Resultado } from "@/components/form-acao";
import { cifrarTexto, criptoPronta } from "@/lib/cripto";
import { contextoDaEmpresa, mensagemDeErro } from "@/lib/empresa";
import { configPublica, cursosDaPessoa, ErroMoodle, infoDoSite, normalizarSite, pedirChave, tipoDeLogin, type TipoDeLogin } from "@/lib/moodle/cliente";
import { alunosDoCurso, conexaoPorId, devolverNoMoodle, sincronizarTurma } from "@/lib/moodle/sincronizar";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { cookieDaTurma, turmaAtual } from "@/lib/turma";

function mensagem(e: unknown, padrao: string) {
  if (e instanceof ErroMoodle) return e.message;
  console.error("[moodle]", e);
  return padrao;
}

export type Exame =
  | { ok: true; site: string; nome: string; tipo: TipoDeLogin; provedores: string[] }
  | { ok: false; mensagem: string };

/** Confere o endereço e descobre como as pessoas entram nesse Moodle (sem senha nem chave). */
export async function examinarMoodle(slug: string, endereco: string): Promise<Exame> {
  const { podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra a conta pode ligar o Moodle." };
  try {
    const site = normalizarSite(endereco);
    const c = await configPublica(site);
    if (c?.enablemobilewebservice === 0) {
      return { ok: false, mensagem: "Este Moodle não libera o acesso por aplicativos. Peça ao suporte da instituição para ativar o “serviço para dispositivos móveis”." };
    }
    if (c?.maintenanceenabled) return { ok: false, mensagem: "O Moodle está em manutenção. Tente de novo mais tarde." };
    return {
      ok: true,
      site,
      nome: (c?.sitename ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 120),
      tipo: tipoDeLogin(c),
      provedores: (c?.identityproviders ?? []).map((p) => String(p.name).replace(/<[^>]+>/g, "").trim()).filter(Boolean).slice(0, 4),
    };
  } catch (e) {
    return { ok: false, mensagem: mensagem(e, "Não foi possível abrir esse endereço. Confira e tente de novo.") };
  }
}

/** Liga o Moodle: troca usuário e senha (ou uma chave de acesso) pela chave, que fica cifrada. A senha não é guardada. */
export async function conectarMoodle(slug: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra a conta pode ligar o Moodle." };
  if (!criptoPronta()) return { ok: false, mensagem: "O servidor ainda não está pronto para guardar a ligação. Avise o suporte." };
  let site: string;
  try {
    site = normalizarSite(String(dados.get("endereco") ?? ""));
    const chaveDireta = String(dados.get("chave") ?? "").trim();
    const usuario = String(dados.get("usuario") ?? "").trim();
    const senha = String(dados.get("senha") ?? "");
    if (!chaveDireta && (!usuario || !senha)) return { ok: false, mensagem: "Digite o usuário e a senha do Moodle." };
    if (chaveDireta && !/^[A-Za-z0-9]{16,128}$/.test(chaveDireta)) return { ok: false, mensagem: "Essa chave de acesso não parece certa." };
    const chave = chaveDireta || (await pedirChave(site, usuario, senha));
    const info = await infoDoSite(site, chave);
    const supabase = await criarClienteServidor();
    const { error } = await supabase.rpc("salvar_conta_moodle", {
      p_org: empresa.id,
      p_site: site,
      p_site_nome: info.sitename ?? "",
      p_usuario: info.userid,
      p_nome: info.fullname ?? "",
      p_token: cifrarTexto(chave),
    });
    if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível guardar a ligação. Tente de novo.") };
  } catch (e) {
    if (e instanceof ErroMoodle && e.reconectar && String(dados.get("chave") ?? "").trim()) {
      return {
        ok: false,
        mensagem:
          "O Moodle não aceitou essa chave. Confira se copiou a da linha “Moodle mobile web service” (e não a chave RSS) e se entrou pelo aplicativo Moodle antes. Se a chave foi trocada, copie a nova.",
      };
    }
    return { ok: false, mensagem: mensagem(e, "Não foi possível falar com o Moodle. Tente de novo.") };
  }
  revalidatePath(`/app/${slug}/moodle`);
  redirect(`/app/${slug}/moodle`);
}

/** Desliga a ligação da própria pessoa. As turmas e entregas que já vieram continuam no Handback. */
export async function desligarMoodle(slug: string, contaId: string): Promise<void> {
  const { podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return;
  const supabase = await criarClienteServidor();
  await supabase.rpc("desligar_conta_moodle", { p_conta: contaId });
  revalidatePath(`/app/${slug}`, "layout");
}

/** Cria uma turma ligada a uma disciplina do Moodle e já traz alunos, grupos, tarefas e entregas. */
export async function ligarDisciplina(slug: string, contaId: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra a conta pode ligar disciplinas." };
  const cursoId = Number(dados.get("curso"));
  if (!Number.isInteger(cursoId) || cursoId <= 0) return { ok: false, mensagem: "Escolha uma disciplina." };
  const supabase = await criarClienteServidor();
  const admin = criarClienteAdmin();
  if (!admin) return { ok: false, mensagem: "O servidor ainda não está pronto. Avise o suporte." };

  // A conexão precisa ser da própria pessoa, nesta conta.
  const { data: minha } = await supabase.from("contas_moodle").select("id").eq("id", contaId).eq("org_id", empresa.id).maybeSingle();
  if (!minha) return { ok: false, mensagem: "Ligue o Moodle de novo." };

  let turmaId: string;
  try {
    const c = await conexaoPorId(admin, contaId);
    const curso = (await cursosDaPessoa(c.site, c.chave, c.usuario)).find((x) => x.id === cursoId);
    if (!curso) return { ok: false, mensagem: "Essa disciplina não está mais na sua lista do Moodle." };
    const alunos = await alunosDoCurso(c, cursoId);
    const modo = alunos.some((a) => a.groups?.length) ? "grupos" : "individual";

    const { data: existentes } = await supabase.from("turmas").select("nome").eq("org_id", empresa.id);
    const usados = new Set((existentes ?? []).map((t) => String(t.nome).trim().toLowerCase()));
    const base = (curso.fullname || curso.shortname || `Disciplina ${cursoId}`).trim().slice(0, 110);
    let nome = base;
    for (let n = 2; usados.has(nome.toLowerCase()); n++) nome = `${base} (${n})`;

    const { data: turma, error } = await supabase
      .from("turmas")
      .insert({ org_id: empresa.id, nome, modo, moodle_conta: contaId, moodle_curso: cursoId, moodle_curso_nome: curso.fullname.slice(0, 300), moodle_site: c.site })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { ok: false, mensagem: "Essa disciplina já está ligada a uma turma." };
      return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível criar a turma. Tente de novo.") };
    }
    turmaId = turma.id;
  } catch (e) {
    return { ok: false, mensagem: mensagem(e, "Não foi possível falar com o Moodle. Tente de novo.") };
  }

  let resumo = "";
  try {
    const r = await sincronizarTurma(admin, turmaId, 0);
    if (r) resumo = `&alunos=${r.alunos}&grupos=${r.grupos}&tarefas=${r.tarefas}&novas=${r.novas}`;
  } catch (e) {
    resumo = `&erro=${encodeURIComponent(mensagem(e, "A turma foi criada, mas a primeira busca falhou."))}`;
  }
  (await cookies()).set(cookieDaTurma(empresa.id), turmaId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath(`/app/${slug}`, "layout");
  redirect(`/app/${slug}/moodle?pronta=${turmaId}${resumo}`);
}

/** Busca agora as entregas novas da turma atual no Moodle. */
export async function buscarNoMoodle(slug: string): Promise<{ ok: boolean; mensagem: string }> {
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const turma = await turmaAtual(empresa.id);
  const admin = criarClienteAdmin();
  if (!turma?.moodle_conta || !admin) return { ok: false, mensagem: "Esta turma não está ligada ao Moodle." };
  try {
    const r = await sincronizarTurma(admin, turma.id);
    revalidatePath(`/app/${slug}`, "layout");
    if (!r) return { ok: true, mensagem: "Acabou de buscar. Espere alguns segundos e tente de novo." };
    const partes = [
      r.novas === 0 ? "Nada novo no Moodle." : r.novas === 1 ? "1 entrega nova chegou do Moodle." : `${r.novas} entregas novas chegaram do Moodle.`,
    ];
    if (r.faltam) partes.push(`Ainda faltam ${r.faltam}: toque em buscar de novo.`);
    if (r.avisos.length) partes.push(r.avisos.join(" "));
    return { ok: true, mensagem: partes.join(" ") };
  } catch (e) {
    revalidatePath(`/app/${slug}`, "layout");
    return { ok: false, mensagem: mensagem(e, "Não foi possível buscar no Moodle. Tente de novo.") };
  }
}

/** Marca se o Handback corrige (busca as entregas de) uma tarefa do Moodle. */
export async function marcarTarefa(slug: string, etapaId: string, corrigir: boolean): Promise<{ ok: boolean; mensagem: string }> {
  const { podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra a conta pode mudar isso." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("etapas").update({ moodle_corrigir: corrigir }).eq("id", etapaId).not("moodle_tarefa", "is", null);
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: "" };
}

/** Devolve a devolutiva aprovada na tarefa do Moodle. */
export async function devolverNoMoodleAcao(
  slug: string,
  entregaId: string,
  comNota: boolean,
): Promise<{ ok: boolean; mensagem: string; reconectar?: boolean }> {
  const { podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) return { ok: false, mensagem: "Você não tem permissão para fazer isso." };
  const supabase = await criarClienteServidor();
  const admin = criarClienteAdmin();
  if (!admin) return { ok: false, mensagem: "O servidor ainda não está pronto. Avise o suporte." };
  try {
    const { nota } = await devolverNoMoodle(supabase, admin, entregaId, comNota);
    revalidatePath(`/app/${slug}`, "layout");
    return { ok: true, mensagem: nota === null ? "Comentário publicado no Moodle." : `Comentário publicado e nota ${String(nota).replace(".", ",")} lançada no Moodle.` };
  } catch (e) {
    revalidatePath(`/app/${slug}`, "layout");
    return { ok: false, mensagem: mensagem(e, "Não foi possível devolver no Moodle. Tente de novo."), reconectar: e instanceof ErroMoodle && e.reconectar };
  }
}

/** Salva quanto vale cada conceito no Moodle (porcentagem da nota máxima da tarefa). */
export async function salvarNotasMoodle(slug: string, _a: Resultado, dados: FormData): Promise<Resultado> {
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) return { ok: false, mensagem: "Só quem administra a conta pode mudar isso." };
  const notas: Record<string, number> = {};
  for (const c of ["EXCELENTE", "BOM", "REGULAR", "RUIM"]) {
    const n = Number(String(dados.get(`nota_${c}`) ?? "").replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100) return { ok: false, mensagem: `${c}: use um número de 0 a 100.` };
    notas[c] = n;
  }
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("organizacoes").update({ notas_moodle: notas }).eq("id", empresa.id);
  if (error) return { ok: false, mensagem: mensagemDeErro(error, "Não foi possível salvar. Tente de novo.") };
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, mensagem: "Notas salvas." };
}

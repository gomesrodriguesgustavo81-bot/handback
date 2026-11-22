import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nomeArquivoSeguro } from "../textos";
import { triar, type ContextoTriagem } from "../triagem";
import type { Vocabulario } from "../frentes";
import { codigosDaCaixa, type EmailRecebido } from "./formatos";

/** Imagens coladas no corpo menores que isso são logos/assinaturas (regra do protótipo). */
const TAMANHO_MIN_IMAGEM_EMBUTIDA = 30 * 1024;
const LIMITE_ARQUIVO = 50 * 1024 * 1024;

export type ResultadoRecebimento =
  | { ok: true; status: "entrega" | "confirmar" | "ignorado"; motivo: string; emailId: string }
  | { ok: false; motivo: string };

/**
 * Recebe um e-mail encaminhado: descobre a empresa pelo endereço, faz a
 * triagem, guarda os anexos (menos de e-mails ignorados) e grava tudo.
 */
export async function receberEmail(admin: SupabaseClient, email: EmailRecebido): Promise<ResultadoRecebimento> {
  const codigos = codigosDaCaixa(email.destinatarios);
  if (!codigos.length) return { ok: false, motivo: "nenhuma caixa de entrada do Handback nos destinatários" };

  // Cada turma tem o próprio endereço; a turma diz qual é a empresa.
  const { data: turma } = await admin
    .from("turmas")
    .select("id, organizacoes(id, ativa, vocabulario, etiqueta_assunto, modo_entrega, assuntos_ignorar)")
    .in("caixa_token", codigos)
    .limit(1)
    .maybeSingle();
  type Org = { id: string; ativa: boolean; vocabulario: unknown; etiqueta_assunto: string; modo_entrega: "confirmar" | "automatico"; assuntos_ignorar: string };
  const org = (turma?.organizacoes ?? null) as unknown as Org | null;
  if (!turma || !org) return { ok: false, motivo: "caixa de entrada desconhecida" };
  if (!org.ativa) return { ok: false, motivo: "empresa bloqueada" };

  const messageId = email.messageId || `<sem-id-${randomUUID()}@handback>`;
  const { data: jaExiste } = await admin
    .from("emails_recebidos")
    .select("id")
    .eq("org_id", org.id)
    .eq("message_id", messageId)
    .maybeSingle();
  if (jaExiste) return { ok: true, status: "ignorado", motivo: "e-mail já recebido antes", emailId: jaExiste.id };

  // Anexos que contam (sem logos/assinaturas coladas no corpo).
  const anexos = email.anexos.filter((a) => !(a.embutido && a.conteudo.length < TAMANHO_MIN_IMAGEM_EMBUTIDA));

  const [etapas, grupos, equipe, comEntrega] = await Promise.all([
    admin.from("etapas").select("id, numero, recebe_de, recebe_ate").eq("turma_id", turma.id),
    admin.from("grupos").select("id, nome, integrantes(email)").eq("turma_id", turma.id).eq("ativo", true),
    admin.rpc("emails_da_equipe_interna", { org: org.id }),
    email.respondeA.length
      ? admin.from("emails_recebidos").select("message_id").eq("org_id", org.id).not("entrega_id", "is", null).in("message_id", email.respondeA)
      : Promise.resolve({ data: [] as { message_id: string }[] }),
  ]);

  const vocabulario = org.vocabulario as Vocabulario;
  const ctx: ContextoTriagem = {
    etiqueta: org.etiqueta_assunto,
    modo: org.modo_entrega,
    assuntosIgnorar: org.assuntos_ignorar,
    palavraEtapa: vocabulario.etapa,
    etapas: etapas.data ?? [],
    grupos: (grupos.data ?? []).map((g) => ({ id: g.id, nome: g.nome, emails: g.integrantes.map((i) => i.email) })),
    emailsDaEquipe: (equipe.data as string[] | null) ?? [],
    mensagensComEntrega: (comEntrega.data ?? []).map((m) => m.message_id),
  };

  const triagem = triar(
    {
      deEmail: email.deEmail,
      assunto: email.assunto,
      texto: email.texto,
      html: email.html,
      enviadoEm: email.enviadoEm,
      respondeA: email.respondeA,
      quantidadeDeAnexos: anexos.length,
    },
    ctx,
  );

  // Privacidade: anexos de e-mails ignorados (ex.: documentos pessoais) NÃO são guardados.
  const emailId = randomUUID();
  const guardados: { caminho?: string; nome: string; tamanho: number; tipo: string }[] = [];
  for (const [i, a] of anexos.entries()) {
    if (triagem.status === "ignorado" || a.conteudo.length > LIMITE_ARQUIVO) {
      guardados.push({ nome: a.nome, tamanho: a.conteudo.length, tipo: a.tipo });
      continue;
    }
    const caminho = `${org.id}/emails/${emailId}/${i + 1}-${nomeArquivoSeguro(a.nome)}`;
    const { error } = await admin.storage.from("entregas").upload(caminho, a.conteudo, {
      contentType: a.tipo || "application/octet-stream",
      upsert: false,
    });
    if (error) {
      triagem.avisos.push(`Não foi possível guardar o anexo "${a.nome}".`);
      guardados.push({ nome: a.nome, tamanho: a.conteudo.length, tipo: a.tipo });
    } else {
      guardados.push({ caminho, nome: a.nome, tamanho: a.conteudo.length, tipo: a.tipo });
    }
  }
  if (anexos.some((a) => a.conteudo.length > LIMITE_ARQUIVO)) triagem.avisos.push("Algum anexo passou de 50 MB e não foi guardado.");

  const { error } = await admin.rpc("receber_email_interno", {
    p_email: {
      id: emailId,
      org_id: org.id,
      turma_id: turma.id,
      message_id: messageId,
      responde_a: email.respondeA,
      de_email: email.deEmail,
      de_nome: email.deNome,
      assunto: email.assunto,
      texto: email.texto,
      enviado_em: email.enviadoEm.toISOString(),
      links: triagem.links,
      anexos: guardados.filter((g) => g.caminho),
      status: triagem.status,
      motivo: triagem.motivo,
      avisos: [
        ...triagem.avisos,
        ...guardados.filter((g) => !g.caminho).map((g) => `Anexo não guardado: ${g.nome}`),
      ],
      etapa_sugerida: triagem.etapaId,
      grupo_sugerido: triagem.grupoId,
    },
    p_entrega: triagem.status === "entrega" ? randomUUID() : null,
  });
  if (error) {
    // Limpa os anexos que subiram, para não ficar arquivo solto.
    const caminhos = guardados.map((g) => g.caminho).filter((c): c is string => Boolean(c));
    if (caminhos.length) await admin.storage.from("entregas").remove(caminhos);
    throw new Error(`Falha ao gravar o e-mail: ${error.message}`);
  }

  return { ok: true, status: triagem.status, motivo: triagem.motivo, emailId };
}

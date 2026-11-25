import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { nomeArquivoSeguro } from "../textos";
import { buscarEmailResend } from "./resend";

const LIMITE_ARQUIVO = 50 * 1024 * 1024;

type Pendente = { nome: string; tamanho: number; tipo: string };
type Guardado = Pendente & { caminho: string };

/**
 * Busca de novo os anexos que não foram guardados (o e-mail tinha sido
 * ignorado, por privacidade, ou o download falhou). Usado quando alguém
 * diz que aquele e-mail era uma entrega. Devolve quantos voltaram e quantos faltaram.
 */
export async function recuperarAnexos(admin: SupabaseClient, emailId: string): Promise<{ voltaram: number; faltaram: string[] }> {
  const { data: m } = await admin.from("emails_recebidos").select("org_id, origem_id, anexos, anexos_pendentes").eq("id", emailId).maybeSingle();
  const pendentes = ((m?.anexos_pendentes ?? []) as Pendente[]).filter((p) => p?.nome);
  if (!m || !pendentes.length) return { voltaram: 0, faltaram: [] };
  const chave = process.env.RESEND_API_KEY;
  const origem = String(m.origem_id ?? "");
  if (!origem.startsWith("resend:") || !chave) return { voltaram: 0, faltaram: pendentes.map((p) => p.nome) };

  let anexos: { nome: string; tipo: string; conteudo: Buffer }[] = [];
  try {
    anexos = (await buscarEmailResend({ data: { email_id: origem.slice(7) } }, chave)).anexos;
  } catch (e) {
    console.error("[recuperar anexos]", e);
    return { voltaram: 0, faltaram: pendentes.map((p) => p.nome) };
  }
  const guardados = [...((m.anexos ?? []) as Guardado[])];
  const faltaram: string[] = [];
  // "*": o e-mail falava de anexo e nenhum tinha chegado. Agora vale qualquer anexo que o serviço tiver.
  const jaGuardados = new Set(guardados.map((g) => g.nome));
  const novos = anexos.filter((a) => !jaGuardados.has(a.nome) && !pendentes.some((p) => p.nome === a.nome));
  const lista = pendentes.flatMap((p) => (p.nome === "*" ? (novos.length ? novos.map((a) => ({ nome: a.nome, tamanho: a.conteudo.length, tipo: a.tipo })) : [p]) : [p]));
  for (const [i, p] of lista.entries()) {
    const a = anexos.find((x) => x.nome === p.nome);
    if (!a || a.conteudo.length > LIMITE_ARQUIVO) {
      faltaram.push(p.nome);
      continue;
    }
    const caminho = `${m.org_id}/emails/${emailId}/r${i + 1}-${nomeArquivoSeguro(a.nome)}`;
    const { error } = await admin.storage.from("entregas").upload(caminho, a.conteudo, { contentType: a.tipo || "application/octet-stream", upsert: true });
    if (error) {
      faltaram.push(p.nome);
      continue;
    }
    guardados.push({ caminho, nome: a.nome, tamanho: a.conteudo.length, tipo: a.tipo });
  }
  const restantes = lista.filter((p) => faltaram.includes(p.nome));
  await admin.from("emails_recebidos").update({ anexos: guardados, anexos_pendentes: restantes }).eq("id", emailId);
  return { voltaram: lista.length - faltaram.length, faltaram: faltaram.map((n) => (n === "*" ? "o anexo citado no e-mail (o serviço não tem nenhum)" : n)) };
}

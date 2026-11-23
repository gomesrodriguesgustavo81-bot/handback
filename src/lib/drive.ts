import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decifrar, ErroGmail, tokenDeAcesso } from "./gmail";

/**
 * Google Drive: os arquivos das entregas de uma turma vão para o Drive de
 * quem ligou, em Handback › <turma> › <equipe>. A permissão drive.file só
 * deixa o Handback ver e mexer no que ele mesmo criou.
 */
function enderecos() {
  const b = process.env.HANDBACK_GOOGLE_BASE?.replace(/\/$/, "");
  return {
    arquivos: b ? `${b}/drive/v3/files` : "https://www.googleapis.com/drive/v3/files",
    enviar: b ? `${b}/upload/drive/v3/files` : "https://www.googleapis.com/upload/drive/v3/files",
  };
}

export class ErroDrive extends Error {
  constructor(
    mensagem: string,
    public status = 0,
  ) {
    super(mensagem);
  }
}

const PASTA = "application/vnd.google-apps.folder";

export async function acessoDoDrive(admin: SupabaseClient, userId: string): Promise<{ email: string; acesso: string } | null> {
  const { data } = await admin.from("conexoes_google").select("email, token_cifrado, invalida").eq("user_id", userId).eq("servico", "drive").maybeSingle();
  if (!data || data.invalida) return null;
  try {
    return { email: data.email, acesso: await tokenDeAcesso(decifrar(data.token_cifrado)) };
  } catch (e) {
    if (e instanceof ErroGmail && e.reconectar) await admin.from("conexoes_google").update({ invalida: true }).eq("user_id", userId).eq("servico", "drive");
    return null;
  }
}

async function json(r: Response) {
  const j = (await r.json().catch(() => ({}))) as { id?: string; trashed?: boolean; error?: { message?: string } };
  if (!r.ok) throw new ErroDrive(j.error?.message ?? `erro ${r.status}`, r.status);
  return j;
}

/** Nome de arquivo/pasta seguro para o Drive. */
const limpo = (s: string) => s.replace(/[\\/\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 150) || "sem nome";

async function pastaExiste(acesso: string, id: string): Promise<boolean> {
  const r = await fetch(`${enderecos().arquivos}/${encodeURIComponent(id)}?fields=id,trashed`, { headers: { authorization: `Bearer ${acesso}` }, signal: AbortSignal.timeout(15_000) });
  if (r.status === 404) return false;
  const j = await json(r);
  return !j.trashed;
}

async function criarPasta(acesso: string, nome: string, pai?: string): Promise<string> {
  const r = await fetch(`${enderecos().arquivos}?fields=id`, {
    method: "POST",
    headers: { authorization: `Bearer ${acesso}`, "content-type": "application/json" },
    body: JSON.stringify({ name: limpo(nome), mimeType: PASTA, ...(pai ? { parents: [pai] } : {}) }),
    signal: AbortSignal.timeout(15_000),
  });
  return String((await json(r)).id);
}

/** Acha (ou cria de novo, se a pessoa apagou) a pasta guardada com esta chave. */
async function pasta(admin: SupabaseClient, userId: string, acesso: string, chave: string, nome: string, pai?: string): Promise<string> {
  const { data } = await admin.from("drive_pastas").select("pasta_id").eq("user_id", userId).eq("chave", chave).maybeSingle();
  if (data?.pasta_id && (await pastaExiste(acesso, data.pasta_id))) return data.pasta_id;
  const id = await criarPasta(acesso, nome, pai);
  await admin.from("drive_pastas").upsert({ user_id: userId, chave, pasta_id: id }, { onConflict: "user_id,chave" });
  return id;
}

async function enviarArquivo(acesso: string, nome: string, tipo: string, dados: Uint8Array, pai: string): Promise<string> {
  const fronteira = `hb${randomBytes(12).toString("hex")}`;
  const meta = JSON.stringify({ name: limpo(nome), parents: [pai] });
  const corpo = Buffer.concat([
    Buffer.from(`--${fronteira}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${fronteira}\r\nContent-Type: ${tipo || "application/octet-stream"}\r\n\r\n`),
    Buffer.from(dados),
    Buffer.from(`\r\n--${fronteira}--`),
  ]);
  const r = await fetch(`${enderecos().enviar}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { authorization: `Bearer ${acesso}`, "content-type": `multipart/related; boundary=${fronteira}` },
    body: corpo,
    signal: AbortSignal.timeout(60_000),
  });
  return String((await json(r)).id);
}

/** Baixa um arquivo que está no Drive de alguém (para abrir ou para a IA ler). */
export async function baixarDoDrive(admin: SupabaseClient, userId: string, driveId: string): Promise<Uint8Array> {
  const con = await acessoDoDrive(admin, userId);
  if (!con) throw new ErroDrive("O arquivo está no Google Drive de quem ligou o Drive nesta turma, e essa conexão foi desfeita.", 401);
  const r = await fetch(`${enderecos().arquivos}/${encodeURIComponent(driveId)}?alt=media`, {
    headers: { authorization: `Bearer ${con.acesso}` },
    signal: AbortSignal.timeout(60_000),
  });
  if (r.status === 404) throw new ErroDrive("O arquivo não está mais no Google Drive (foi apagado ou movido para a lixeira).", 404);
  if (!r.ok) throw new ErroDrive(`O Google Drive não entregou o arquivo (erro ${r.status}).`, r.status);
  return new Uint8Array(await r.arrayBuffer());
}

export type RodadaDrive = { levados: number; erros: number; restam: boolean };

/**
 * Leva para o Drive os arquivos que estão esperando (os novos e, se a turma
 * pediu, os antigos). Depois de enviar, apaga a cópia do Handback.
 */
export async function levarParaODrive(admin: SupabaseClient, ateMs: number): Promise<RodadaDrive> {
  const r: RodadaDrive = { levados: 0, erros: 0, restam: false };
  const acessos = new Map<string, string | null>();
  while (Date.now() < ateMs) {
    const { data } = await admin.rpc("arquivos_para_drive", { p_limite: 10 });
    const lista = (data ?? []) as {
      id: string; caminho: string; nome: string; tipo: string; turma_id: string; turma_nome: string;
      grupo_id: string; grupo_nome: string; etapa_numero: number; drive_por: string; tentativas: number;
    }[];
    if (!lista.length) return r;
    for (const a of lista) {
      if (Date.now() >= ateMs) {
        r.restam = true;
        return r;
      }
      if (!acessos.has(a.drive_por)) acessos.set(a.drive_por, (await acessoDoDrive(admin, a.drive_por))?.acesso ?? null);
      const acesso = acessos.get(a.drive_por);
      if (!acesso) {
        await admin.from("turmas").update({ drive_erro: "A conexão com o Google Drive expirou ou foi desconectada." }).eq("id", a.turma_id);
        await admin.from("arquivos_entrega").update({ drive_tentativas: a.tentativas + 1, drive_erro: "sem conexão com o Drive" }).eq("id", a.id);
        r.erros++;
        continue;
      }
      try {
        const raiz = await pasta(admin, a.drive_por, acesso, "raiz", "Handback");
        const turma = await pasta(admin, a.drive_por, acesso, `turma:${a.turma_id}`, a.turma_nome, raiz);
        const grupo = await pasta(admin, a.drive_por, acesso, `grupo:${a.grupo_id}`, a.grupo_nome, turma);
        const { data: blob, error } = await admin.storage.from("entregas").download(a.caminho);
        if (error || !blob) throw new ErroDrive("o arquivo não foi encontrado no Handback");
        const id = await enviarArquivo(acesso, `${a.etapa_numero} - ${a.nome}`, a.tipo, new Uint8Array(await blob.arrayBuffer()), grupo);
        await admin.from("arquivos_entrega").update({ drive_id: id, drive_por: a.drive_por, drive_erro: "", caminho: null }).eq("id", a.id);
        await admin.storage.from("entregas").remove([a.caminho]);
        await admin.from("turmas").update({ drive_erro: "" }).eq("id", a.turma_id);
        r.levados++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (e instanceof ErroDrive && e.status === 401) await admin.from("conexoes_google").update({ invalida: true }).eq("user_id", a.drive_por).eq("servico", "drive");
        await admin.from("arquivos_entrega").update({ drive_tentativas: a.tentativas + 1, drive_erro: msg.slice(0, 300) }).eq("id", a.id);
        r.erros++;
      }
    }
  }
  r.restam = true;
  return r;
}

/** Mesma coisa, com o tempo em milissegundos a partir de agora. */
export function levarParaODrivePor(admin: SupabaseClient, ms: number): Promise<RodadaDrive> {
  return levarParaODrive(admin, Date.now() + ms);
}

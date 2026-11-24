import "server-only";

/**
 * Conversa com o Google Classroom (e com o Drive, só para baixar os arquivos
 * que o professor escolheu). Sempre com o token do próprio professor.
 * HANDBACK_GOOGLE_BASE troca os endereços do Google (só para testes).
 */
function enderecos() {
  const b = process.env.HANDBACK_GOOGLE_BASE?.replace(/\/$/, "");
  return {
    classroom: b ? `${b}/classroom/v1` : "https://classroom.googleapis.com/v1",
    arquivos: b ? `${b}/drive/v3/files` : "https://www.googleapis.com/drive/v3/files",
  };
}

export class ErroClassroom extends Error {
  constructor(
    mensagem: string,
    public status = 0,
    public reconectar = false,
  ) {
    super(mensagem);
  }
}

async function pedir<T>(acesso: string, caminho: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(caminho.startsWith("http") ? caminho : `${enderecos().classroom}${caminho}`, {
    ...init,
    headers: { authorization: `Bearer ${acesso}`, ...(init.body ? { "content-type": "application/json" } : {}), ...init.headers },
    signal: AbortSignal.timeout(30_000),
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: { message?: string; status?: string } };
  if (!r.ok) {
    const msg = j.error?.message ?? `erro ${r.status}`;
    if (r.status === 401) throw new ErroClassroom("A conexão com o Google Classroom expirou. Conecte de novo.", 401, true);
    if (r.status === 403 && /ProjectPermissionDenied/i.test(msg)) {
      throw new ErroClassroom("O Google só deixa lançar nota em tarefa criada pelo Handback. Lance esta nota direto no Classroom.", 403);
    }
    if (r.status === 403 && /scope|insufficient/i.test(msg)) {
      throw new ErroClassroom("Faltou uma permissão do Classroom. Conecte de novo e marque todas as opções.", 403, true);
    }
    throw new ErroClassroom(`O Classroom recusou (${msg}).`, r.status);
  }
  return j;
}

/** Junta todas as páginas de uma lista do Classroom. */
async function todas<T>(acesso: string, caminho: string, campo: string, limite = 30): Promise<T[]> {
  const itens: T[] = [];
  let token = "";
  for (let i = 0; i < limite; i++) {
    const sep = caminho.includes("?") ? "&" : "?";
    const j = await pedir<Record<string, unknown>>(acesso, `${caminho}${sep}pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`);
    itens.push(...((j[campo] as T[] | undefined) ?? []));
    token = String(j.nextPageToken ?? "");
    if (!token) break;
  }
  return itens;
}

const id = (x: string) => encodeURIComponent(x);

export type Curso = { id: string; name: string; section?: string; alternateLink?: string };
export type AlunoClassroom = { userId: string; profile?: { name?: { fullName?: string }; emailAddress?: string } };
export type DataClassroom = { year: number; month: number; day: number };
export type TarefaClassroom = {
  id: string;
  title: string;
  description?: string;
  state?: string;
  workType?: string;
  dueDate?: DataClassroom;
  dueTime?: { hours?: number; minutes?: number };
  maxPoints?: number;
  alternateLink?: string;
  associatedWithDeveloper?: boolean;
  creationTime?: string;
};
export type Anexo = {
  driveFile?: { id: string; title?: string; alternateLink?: string };
  youTubeVideo?: { id?: string; title?: string; alternateLink?: string };
  link?: { url: string; title?: string };
  form?: { formUrl?: string; title?: string };
};
export type EnvioClassroom = {
  id: string;
  userId: string;
  state: string;
  late?: boolean;
  creationTime?: string;
  updateTime?: string;
  assignmentSubmission?: { attachments?: Anexo[] };
  shortAnswerSubmission?: { answer?: string };
  multipleChoiceSubmission?: { answer?: string };
  submissionHistory?: { stateHistory?: { state?: string; stateTimestamp?: string } }[];
};

/** Turmas ativas em que a pessoa é professora. */
export async function meusCursos(acesso: string): Promise<Curso[]> {
  return todas<Curso>(acesso, "/courses?teacherId=me&courseStates=ACTIVE", "courses", 5);
}

export async function curso(acesso: string, cursoId: string): Promise<Curso> {
  return pedir<Curso>(acesso, `/courses/${id(cursoId)}`);
}

export async function alunos(acesso: string, cursoId: string): Promise<AlunoClassroom[]> {
  return todas<AlunoClassroom>(acesso, `/courses/${id(cursoId)}/students`, "students");
}

export async function tarefas(acesso: string, cursoId: string): Promise<TarefaClassroom[]> {
  return todas<TarefaClassroom>(acesso, `/courses/${id(cursoId)}/courseWork?courseWorkStates=PUBLISHED`, "courseWork");
}

/** Envios entregues (ou já devolvidos) de uma tarefa. */
export async function envios(acesso: string, cursoId: string, tarefaId: string): Promise<EnvioClassroom[]> {
  return todas<EnvioClassroom>(
    acesso,
    `/courses/${id(cursoId)}/courseWork/${id(tarefaId)}/studentSubmissions?states=TURNED_IN&states=RETURNED`,
    "studentSubmissions",
  );
}

/** Quando o aluno entregou por último (o envio muda de hora quando recebe nota, isto não). */
export function entregueEm(e: EnvioClassroom): string {
  const vezes = (e.submissionHistory ?? [])
    .map((h) => h.stateHistory)
    .filter((h) => h?.state === "TURNED_IN" && h.stateTimestamp)
    .map((h) => h!.stateTimestamp!)
    .sort();
  return vezes.at(-1) ?? e.updateTime ?? e.creationTime ?? new Date().toISOString();
}

/** Data (AAAA-MM-DD) do prazo da tarefa, no horário de Brasília. */
export function prazoDaTarefa(t: TarefaClassroom): string | null {
  if (!t.dueDate?.year || !t.dueDate.month || !t.dueDate.day) return null;
  const utc = Date.UTC(t.dueDate.year, t.dueDate.month - 1, t.dueDate.day, t.dueTime?.hours ?? 0, t.dueTime?.minutes ?? 0);
  return new Date(utc - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Prazo AAAA-MM-DD às 23:59 de Brasília, no formato do Classroom (UTC). */
export function prazoParaClassroom(data: string): { dueDate: DataClassroom; dueTime: { hours: number; minutes: number } } {
  const [a, m, d] = data.split("-").map(Number);
  const utc = new Date(Date.UTC(a, m - 1, d, 23 + 3, 59));
  return {
    dueDate: { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() },
    dueTime: { hours: utc.getUTCHours(), minutes: utc.getUTCMinutes() },
  };
}

export async function criarTarefa(
  acesso: string,
  cursoId: string,
  t: { titulo: string; descricao: string; prazo: string | null; notaMax: number },
): Promise<TarefaClassroom> {
  return pedir<TarefaClassroom>(acesso, `/courses/${id(cursoId)}/courseWork`, {
    method: "POST",
    body: JSON.stringify({
      title: t.titulo.slice(0, 3000),
      description: t.descricao.slice(0, 30000),
      workType: "ASSIGNMENT",
      state: "PUBLISHED",
      maxPoints: t.notaMax,
      ...(t.prazo ? prazoParaClassroom(t.prazo) : {}),
    }),
  });
}

/** Apaga uma tarefa criada pelo Handback (se já não existir lá, tudo bem). */
export async function apagarTarefa(acesso: string, cursoId: string, tarefaId: string): Promise<void> {
  try {
    await pedir(acesso, `/courses/${id(cursoId)}/courseWork/${id(tarefaId)}`, { method: "DELETE" });
  } catch (e) {
    if (e instanceof ErroClassroom && e.status === 404) return;
    throw e;
  }
}

/** Lança a nota (rascunho e definitiva) e devolve o trabalho ao aluno. */
export async function lancarNota(acesso: string, cursoId: string, tarefaId: string, envioId: string, nota: number): Promise<void> {
  const base = `/courses/${id(cursoId)}/courseWork/${id(tarefaId)}/studentSubmissions/${id(envioId)}`;
  await pedir(acesso, `${base}?updateMask=assignedGrade,draftGrade`, { method: "PATCH", body: JSON.stringify({ assignedGrade: nota, draftGrade: nota }) });
  await pedir(acesso, `${base}:return`, { method: "POST", body: "{}" });
}

// ---------------------------------------------------------------------
// Drive: só os arquivos escolhidos pelo professor (permissão drive.file)
// ---------------------------------------------------------------------
const EXPORTAR: Record<string, { tipo: string; ext: string }> = {
  "application/vnd.google-apps.document": { tipo: "application/pdf", ext: ".pdf" },
  "application/vnd.google-apps.presentation": { tipo: "application/pdf", ext: ".pdf" },
  "application/vnd.google-apps.drawing": { tipo: "application/pdf", ext: ".pdf" },
  "application/vnd.google-apps.spreadsheet": { tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: ".xlsx" },
};
const MAX_BYTES = 50 * 1024 * 1024;

/** Baixa um arquivo do Drive (documentos do Google viram PDF ou planilha). */
export async function baixarDoDrive(acesso: string, driveId: string): Promise<{ nome: string; tipo: string; dados: Uint8Array }> {
  const base = `${enderecos().arquivos}/${id(driveId)}`;
  const auth = { authorization: `Bearer ${acesso}` };
  const r = await fetch(`${base}?fields=id,name,mimeType,size`, { headers: auth, signal: AbortSignal.timeout(20_000) });
  const meta = (await r.json().catch(() => ({}))) as { name?: string; mimeType?: string; size?: string; error?: { message?: string } };
  if (r.status === 404 || r.status === 403) throw new ErroClassroom("O Handback não tem acesso a este arquivo. Escolha-o na janela do Google.", r.status);
  if (!r.ok) throw new ErroClassroom(`O Drive recusou (${meta.error?.message ?? r.status}).`, r.status);
  if (Number(meta.size ?? 0) > MAX_BYTES) throw new ErroClassroom("Arquivo maior que 50 MB.");
  const exportar = EXPORTAR[meta.mimeType ?? ""];
  const url = exportar ? `${base}/export?mimeType=${encodeURIComponent(exportar.tipo)}` : `${base}?alt=media`;
  const d = await fetch(url, { headers: auth, signal: AbortSignal.timeout(60_000) });
  if (!d.ok) throw new ErroClassroom(`Não deu para baixar (${d.status}).`, d.status);
  const dados = new Uint8Array(await d.arrayBuffer());
  if (dados.length > MAX_BYTES) throw new ErroClassroom("Arquivo maior que 50 MB.");
  const nome = (meta.name ?? "arquivo").trim() || "arquivo";
  return {
    nome: exportar && !nome.toLowerCase().endsWith(exportar.ext) ? `${nome}${exportar.ext}` : nome,
    tipo: exportar?.tipo ?? meta.mimeType ?? "application/octet-stream",
    dados,
  };
}

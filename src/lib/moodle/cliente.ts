import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Conversa com o Moodle da instituição pelo serviço de aplicativos
 * (o mesmo que o app oficial do Moodle usa: "moodle_mobile_app").
 *
 * A senha só passa por aqui uma vez, para o Moodle devolver uma chave de
 * acesso (token). Quem guarda a chave (cifrada) é quem chama.
 *
 * Segurança: o endereço é digitado pelo cliente, então só aceitamos https
 * e nunca endereços internos (127.0.0.1, 10.x, 192.168.x…), para ninguém
 * usar o Handback para alcançar a rede da Vercel ou do Supabase.
 * HANDBACK_MOODLE_LOCAL=1 libera http e endereços locais (só para testes).
 */

export class ErroMoodle extends Error {
  constructor(
    mensagem: string,
    /** A chave de acesso não vale mais: é preciso ligar de novo. */
    public reconectar = false,
  ) {
    super(mensagem);
  }
}

/** Funções do Moodle que o Handback usa. */
export const FUNCOES_NECESSARIAS = [
  "core_webservice_get_site_info",
  "core_enrol_get_users_courses",
  "core_enrol_get_enrolled_users",
  "mod_assign_get_assignments",
  "mod_assign_get_submissions",
  "mod_assign_get_grades",
  "mod_assign_save_grade",
] as const;

const LIMITE_ARQUIVO = 50 * 1024 * 1024;

function modoLocal() {
  return process.env.HANDBACK_MOODLE_LOCAL === "1";
}

/**
 * Arruma o endereço digitado: "ava.faculdade.edu.br/login/index.php" →
 * "https://ava.faculdade.edu.br". Mantém a pasta quando o Moodle não está
 * na raiz ("…/moodle").
 */
export function normalizarSite(digitado: string): string {
  let t = digitado.trim();
  if (!t) throw new ErroMoodle("Coloque o endereço do Moodle.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) t = `https://${t}`;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    throw new ErroMoodle("Esse endereço não parece certo. Copie o endereço que aparece no navegador quando você abre o Moodle.");
  }
  if (u.protocol === "http:" && !modoLocal()) u.protocol = "https:";
  if (u.protocol !== "https:" && !(modoLocal() && u.protocol === "http:")) {
    throw new ErroMoodle("O endereço do Moodle precisa começar com https://.");
  }
  if (u.username || u.password) throw new ErroMoodle("Coloque só o endereço do Moodle, sem usuário ou senha nele.");
  let caminho = u.pathname
    .replace(/\/(login|my|course|mod|admin|user|webservice|index\.php|dashboard).*$/i, "")
    .replace(/\/+$/, "");
  if (caminho === "/") caminho = "";
  return `${u.protocol}//${u.host.toLowerCase()}${caminho}`;
}

/** Endereços que nunca podem ser chamados (rede interna, máquina local etc.). */
export function ipProibido(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) || a >= 224
    );
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === "::" || x === "::1") return true;
    const mapeado = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapeado) return ipProibido(mapeado[1]);
    return /^(fc|fd|fe[89ab]|ff)/.test(x) || x.startsWith("64:ff9b:") || x.startsWith("2001:db8");
  }
  return true;
}

async function conferirDestino(url: URL) {
  if (modoLocal()) return;
  if (url.protocol !== "https:") throw new ErroMoodle("O endereço do Moodle precisa começar com https://.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^localhost$|\.local$|\.internal$/i.test(host)) throw new ErroMoodle("Esse endereço não pode ser usado.");
  const ips = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!ips.length) throw new ErroMoodle("Não encontramos esse endereço. Confira se está escrito certo.");
  if (ips.some((i) => ipProibido(i.address))) throw new ErroMoodle("Esse endereço não pode ser usado.");
}

/** Chamada HTTP segura: confere o destino e não segue redirecionamentos sozinho. */
async function pedir(url: URL, init: RequestInit & { tempo?: number }): Promise<Response> {
  await conferirDestino(url);
  let r: Response;
  try {
    r = await fetch(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(init.tempo ?? 30_000) });
  } catch {
    throw new ErroMoodle("O Moodle não respondeu. Confira o endereço ou tente de novo daqui a pouco.");
  }
  if (r.status >= 300 && r.status < 400) {
    const destino = r.headers.get("location");
    let dica = "";
    try {
      if (destino) dica = ` Tente com ${new URL(destino, url).origin}.`;
    } catch {
      /* sem dica */
    }
    throw new ErroMoodle(`Esse endereço manda para outro lugar.${dica}`);
  }
  return r;
}

/** Transforma { a: [1, 2], b: { c: "x" } } em a[0]=1&a[1]=2&b[c]=x (o formato do Moodle). */
export function achatar(dados: Record<string, unknown>, prefixo = "", saida = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(dados)) {
    const nome = prefixo ? `${prefixo}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === "object") achatar(item as Record<string, unknown>, `${nome}[${i}]`, saida);
        else saida.append(`${nome}[${i}]`, String(item));
      });
    } else if (typeof v === "object") {
      achatar(v as Record<string, unknown>, nome, saida);
    } else {
      saida.append(nome, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
    }
  }
  return saida;
}

const ERROS_LOGIN: Record<string, string> = {
  invalidlogin: "Usuário ou senha do Moodle incorretos.",
  enablewsdescription: "Este Moodle não libera o acesso por aplicativos. Peça ao suporte da instituição para ativar o “serviço para dispositivos móveis”.",
  servicenotavailable: "Este Moodle não libera o acesso por aplicativos. Peça ao suporte da instituição para ativar o “serviço para dispositivos móveis”.",
  sitemaintenance: "O Moodle está em manutenção. Tente de novo mais tarde.",
  usernotconfirmed: "Sua conta no Moodle ainda não foi confirmada.",
  forcepasswordchangenotice: "O Moodle está pedindo para você trocar a senha. Entre no Moodle, troque a senha e tente de novo.",
  restoredaccountresetpassword: "O Moodle está pedindo para você trocar a senha. Entre no Moodle, troque a senha e tente de novo.",
};

/** Troca usuário e senha por uma chave de acesso. A senha não é guardada. */
export async function pedirChave(site: string, usuario: string, senha: string): Promise<string> {
  const r = await pedir(new URL(`${site}/login/token.php`), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({ username: usuario, password: senha, service: "moodle_mobile_app" }),
  });
  const j = (await r.json().catch(() => null)) as { token?: string; error?: string; errorcode?: string } | null;
  if (!j) throw new ErroMoodle("Esse endereço não parece ser de um Moodle. Copie o endereço que aparece no navegador quando você abre o Moodle.");
  if (j.token) return j.token;
  throw new ErroMoodle(ERROS_LOGIN[j.errorcode ?? ""] ?? `O Moodle recusou: ${j.error ?? "erro desconhecido"}.`);
}

/** Chama uma função do Moodle e devolve o resultado (ou um erro claro). */
export async function chamar<T>(site: string, chave: string, funcao: string, parametros: Record<string, unknown> = {}): Promise<T> {
  const url = new URL(`${site}/webservice/rest/server.php`);
  url.searchParams.set("moodlewsrestformat", "json");
  url.searchParams.set("wsfunction", funcao);
  const corpo = achatar(parametros);
  corpo.set("wstoken", chave);
  const r = await pedir(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: corpo,
  });
  const j = (await r.json().catch(() => undefined)) as unknown;
  if (j === undefined) throw new ErroMoodle(`O Moodle respondeu algo inesperado (${r.status}).`);
  const erro = j as { exception?: string; errorcode?: string; message?: string } | null;
  if (erro && typeof erro === "object" && !Array.isArray(erro) && erro.exception) {
    if (erro.errorcode === "invalidtoken" || erro.errorcode === "accessexception" && /token/i.test(erro.message ?? "")) {
      throw new ErroMoodle("A ligação com o Moodle expirou ou foi cortada. Ligue de novo em Ajustes › Moodle.", true);
    }
    if (erro.errorcode === "servicenotavailable" || /not available|não está disponível/i.test(erro.message ?? "")) {
      throw new ErroMoodle(`Este Moodle não libera “${funcao}” para aplicativos.`);
    }
    throw new ErroMoodle(`O Moodle recusou: ${erro.message ?? erro.errorcode ?? "erro desconhecido"}`);
  }
  return j as T;
}

/** Baixa um arquivo de uma entrega (só do próprio Moodle). */
export async function baixarArquivo(site: string, chave: string, endereco: string): Promise<Buffer> {
  const url = new URL(endereco);
  const base = new URL(site);
  if (url.origin !== base.origin) throw new ErroMoodle("Arquivo fora do Moodle ligado.");
  url.searchParams.set("token", chave);
  const r = await pedir(url, { method: "GET", tempo: 60_000 });
  if (!r.ok) throw new ErroMoodle(`O Moodle não entregou o arquivo (${r.status}).`);
  if (Number(r.headers.get("content-length") ?? 0) > LIMITE_ARQUIVO) throw new ErroMoodle("Arquivo maior que 50 MB.");
  const dados = Buffer.from(await r.arrayBuffer());
  if (dados.length > LIMITE_ARQUIVO) throw new ErroMoodle("Arquivo maior que 50 MB.");
  return dados;
}

// ---------------------------------------------------------------------
// Tipos (só os campos que o Handback usa)
// ---------------------------------------------------------------------
export type InfoSite = { sitename: string; fullname: string; userid: number; functions?: { name: string }[] };
export type Curso = { id: number; fullname: string; shortname: string; visible?: number; enddate?: number };
export type Participante = {
  id: number;
  fullname: string;
  email?: string;
  roles?: { shortname: string }[];
  groups?: { id: number; name: string }[];
};
export type Tarefa = {
  id: number;
  cmid: number;
  name: string;
  intro?: string;
  duedate?: number;
  allowsubmissionsfromdate?: number;
  teamsubmission?: number;
  grade?: number;
};
export type ArquivoMoodle = { filename: string; filesize: number; fileurl: string; mimetype?: string };
export type EnvioMoodle = {
  id: number;
  userid: number;
  groupid?: number;
  status: string;
  timemodified: number;
  plugins?: {
    type: string;
    fileareas?: { area: string; files?: ArquivoMoodle[] }[];
    editorfields?: { name: string; text: string }[];
  }[];
};

/** Confere a chave e devolve quem é a pessoa no Moodle. */
export async function infoDoSite(site: string, chave: string): Promise<InfoSite> {
  const info = await chamar<InfoSite>(site, chave, "core_webservice_get_site_info");
  const tem = new Set((info.functions ?? []).map((f) => f.name));
  if (tem.size) {
    const faltam = FUNCOES_NECESSARIAS.filter((f) => !tem.has(f));
    if (faltam.length) {
      throw new ErroMoodle(`Este Moodle não libera tudo o que o Handback precisa para aplicativos (falta: ${faltam.join(", ")}). Peça ao suporte da instituição.`);
    }
  }
  return info;
}

export function cursosDaPessoa(site: string, chave: string, usuario: number) {
  return chamar<Curso[]>(site, chave, "core_enrol_get_users_courses", { userid: usuario });
}

export function participantes(site: string, chave: string, curso: number) {
  return chamar<Participante[]>(site, chave, "core_enrol_get_enrolled_users", { courseid: curso });
}

export async function tarefasDoCurso(site: string, chave: string, curso: number): Promise<Tarefa[]> {
  const r = await chamar<{ courses?: { id: number; assignments?: Tarefa[] }[] }>(site, chave, "mod_assign_get_assignments", { courseids: [curso] });
  return r.courses?.find((c) => c.id === curso)?.assignments ?? [];
}

export async function enviosDaTarefa(site: string, chave: string, tarefa: number): Promise<EnvioMoodle[]> {
  const r = await chamar<{ assignments?: { assignmentid: number; submissions?: EnvioMoodle[] }[] }>(site, chave, "mod_assign_get_submissions", {
    assignmentids: [tarefa],
  });
  return r.assignments?.find((a) => a.assignmentid === tarefa)?.submissions ?? [];
}

/** Nota atual de cada aluno na tarefa (-1 = sem nota). */
export async function notasDaTarefa(site: string, chave: string, tarefa: number): Promise<Map<number, number>> {
  const r = await chamar<{ assignments?: { assignmentid: number; grades?: { userid: number; grade: string }[] }[] }>(site, chave, "mod_assign_get_grades", {
    assignmentids: [tarefa],
  });
  const m = new Map<number, number>();
  for (const g of r.assignments?.find((a) => a.assignmentid === tarefa)?.grades ?? []) {
    const n = Number(g.grade);
    m.set(g.userid, Number.isFinite(n) ? n : -1);
  }
  return m;
}

/** Grava o comentário (feedback) e a nota de um aluno; com "todos", vale para o grupo inteiro. */
export async function salvarDevolutiva(
  site: string,
  chave: string,
  d: { tarefa: number; aluno: number; nota: number; comentarioHtml: string; todosDoGrupo: boolean },
): Promise<void> {
  await chamar<null>(site, chave, "mod_assign_save_grade", {
    assignmentid: d.tarefa,
    userid: d.aluno,
    grade: d.nota,
    attemptnumber: -1,
    addattempt: 0,
    workflowstate: "",
    applytoall: d.todosDoGrupo ? 1 : 0,
    plugindata: { assignfeedbackcomments_editor: { text: d.comentarioHtml, format: 1 } },
  });
}

// ---------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------
/** HTML do Moodle → texto simples. */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Texto da devolutiva → HTML do comentário no Moodle (parágrafos, sem nada além do texto). */
export function textoParaHtml(texto: string, conceito?: string | null): string {
  const paragrafos = texto
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${escapar(p).replace(/\n/g, "<br>")}</p>`);
  if (conceito) paragrafos.unshift(`<p><strong>Conceito: ${escapar(conceito)}</strong></p>`);
  return paragrafos.join("");
}

/** Nota no Moodle a partir do conceito (porcentagem da nota máxima), com uma casa decimal. */
export function notaDoConceito(notaMax: number | null | undefined, porcentagem: number | null | undefined): number | null {
  if (!notaMax || notaMax <= 0 || porcentagem === null || porcentagem === undefined || !Number.isFinite(porcentagem)) return null;
  return Math.round(((notaMax * porcentagem) / 100) * 10) / 10;
}

/** Unix (segundos) → data AAAA-MM-DD no horário de Brasília. */
export function dataDoMoodle(segundos: number | undefined): string | null {
  if (!segundos) return null;
  return new Date(segundos * 1000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

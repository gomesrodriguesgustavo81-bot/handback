/**
 * Proteção dos dados do aluno antes de o texto ir para a IA:
 *  • o nome do aluno ou da equipe vira um código estável ("Aluno 3F9K");
 *  • e-mail, telefone, CPF e os nomes do cadastro viram marcas ("[e-mail]", "[telefone]", "[cpf]", "[nome]").
 * Só vale para TEXTO. PDFs e imagens são enviados inteiros (não dá para apagar de dentro deles).
 */

const sem = (t: string) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const RE_CPF_FORMATADO = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;
const RE_CPF_SOLTO = /\b\d{11}\b/g;
// Telefones do Brasil: com +55 e/ou DDD entre parênteses, "11 99999-8888", 11 dígitos colados (DDD + 9), ou "99999-8888".
const RE_TELEFONES = [
  /(?:\+55\s?)?\(\d{2}\)\s?9?\d{4}[-\s]?\d{4}/g,
  /(?:\+55\s?)?\b\d{2}\s9?\d{4}[-\s]\d{4}\b/g,
  /\b[1-9]\d9\d{8}\b/g,
  /\b9\d{4}-\d{4}\b/g,
];

/** CPF de verdade? (os dois dígitos de conferência batem). Evita esconder qualquer número de 11 dígitos. */
export function cpfValido(bruto: string): boolean {
  const d = bruto.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dig = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
}

export type Achados = { cpf: number; telefone: number; email: number };

function cpfsDe(texto: string): string[] {
  const formatados = texto.match(RE_CPF_FORMATADO) ?? [];
  const soltos = (texto.match(RE_CPF_SOLTO) ?? []).filter(cpfValido);
  return [...formatados.filter(cpfValido), ...soltos];
}

/** Quantos CPFs, telefones e e-mails há no texto (para o aviso ao professor). */
export function acharDadosPessoais(texto: string): Achados {
  const t = String(texto ?? "");
  const cpfs = cpfsDe(t);
  let semCpf = t;
  for (const c of cpfs) semCpf = semCpf.split(c).join(" ");
  let telefones = 0;
  for (const re of RE_TELEFONES) {
    const achou = semCpf.match(re) ?? [];
    telefones += achou.length;
    for (const a of achou) semCpf = semCpf.split(a).join(" ");
  }
  return { cpf: cpfs.length, telefone: telefones, email: (t.match(RE_EMAIL) ?? []).length };
}

function escapar(t: string) {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Esconde o que identifica. `nomes` são nomes por inteiro (da equipe e de quem entrega); nomes soltos
 * e comuns ("Ana") não são escondidos para não estragar o texto.
 */
export function mascarar(texto: string, nomes: string[] = []): string {
  let t = String(texto ?? "");
  for (const c of cpfsDe(t)) t = t.split(c).join("[cpf]");
  for (const re of RE_TELEFONES) t = t.replace(re, "[telefone]");
  t = t.replace(RE_EMAIL, "[e-mail]");
  const alvo = [...new Set(nomes.map((n) => String(n ?? "").trim()).filter((n) => n.length >= 5))].sort((a, b) => b.length - a.length);
  for (const n of alvo) {
    // Acha o nome sem ligar para maiúsculas nem acentos (compara o texto sem acentos, mas troca no original).
    const base = sem(t);
    const padrao = new RegExp(`(^|[^a-z0-9])(${escapar(sem(n))})(?![a-z0-9])`, "g");
    let saida = "";
    let ultimo = 0;
    for (const m of base.matchAll(padrao)) {
      const ini = (m.index ?? 0) + m[1].length;
      saida += t.slice(ultimo, ini) + "[nome]";
      ultimo = ini + m[2].length;
    }
    t = saida + t.slice(ultimo);
  }
  return t;
}

/** Código curto e estável de um aluno ou equipe (as mesmas letras toda vez que a pessoa é analisada). */
export function codigoDoGrupo(id: string, rotulo: string): string {
  const s = String(id ?? "").replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
  return `${rotulo} ${s.slice(0, 4) || "0000"}`;
}

/** Nome de arquivo sem o que identifica (nomes do cadastro, e-mails e números). */
export const mascararNomeDeArquivo = mascarar;

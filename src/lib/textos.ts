/** Utilidades para ler e mostrar o que as pessoas digitam. */

/** Um item por linha → lista sem linhas vazias e sem marcadores ("-", "•", "1."). */
export function linhas(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function emailValido(email: string): boolean {
  return EMAIL.test(email);
}

/** E-mails separados por vírgula, ponto e vírgula, espaço ou linha → lista limpa e sem repetição. */
export function lerEmails(texto: string): { validos: string[]; invalidos: string[] } {
  const partes = texto
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase().replace(/^<|>$/g, ""))
    .filter(Boolean);
  const validos = [...new Set(partes.filter(emailValido))];
  const invalidos = partes.filter((e) => !emailValido(e));
  return { validos, invalidos };
}

/** "2026-12-01" → "01/12/2026" (sem fuso horário, é só uma data). */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** Hoje em Brasília, no formato "AAAA-MM-DD". */
export function hojeISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Texto do formulário → data ISO ou null (aceita vazio). */
export function lerData(valor: FormDataEntryValue | null): string | null {
  const v = String(valor ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export function minusc(palavra: string): string {
  return palavra.charAt(0).toLowerCase() + palavra.slice(1);
}

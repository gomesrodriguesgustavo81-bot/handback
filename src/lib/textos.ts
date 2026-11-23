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

/** Data e hora em Brasília: "05/12/2026 às 14:30". */
export function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const p = (t: string) => f.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}/${p("month")}/${p("year")} às ${p("hour")}:${p("minute")}`;
}

/** 1536 → "1,5 MB" */
export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1).replace(".", ",")} MB`;
  return `${(mb / 1024).toFixed(1).replace(".", ",")} GB`;
}

/** Nome de arquivo seguro para guardar: sem acentos, espaços ou barras. */
export function nomeArquivoSeguro(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-120);
  return limpo || "arquivo";
}

/** Links, um por linha (ou separados por espaço): só http(s). */
export function lerLinks(texto: string): { validos: string[]; invalidos: string[] } {
  const partes = texto.split(/\s+/).map((l) => l.trim()).filter(Boolean);
  const validos: string[] = [];
  const invalidos: string[] = [];
  for (const p of partes) {
    try {
      const u = new URL(p);
      if (u.protocol === "http:" || u.protocol === "https:") validos.push(u.toString());
      else invalidos.push(p);
    } catch {
      invalidos.push(p);
    }
  }
  return { validos: [...new Set(validos)], invalidos };
}

/** Já se passaram mais de `minutos` desde este instante? */
export function passouMaisDe(iso: string, minutos: number): boolean {
  return Date.now() - new Date(iso).getTime() > minutos * 60 * 1000;
}

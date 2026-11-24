import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { strFromU8, unzlibSync } from "fflate";

/**
 * Entregas parecidas demais: cada entrega analisada ganha uma "impressão
 * digital" do texto (MinHash de trechos de 5 palavras) e os códigos (SHA-256)
 * dos arquivos. Duas equipes da mesma aula com impressões muito parecidas,
 * ou com o mesmo arquivo, geram um aviso. O texto em si não é guardado.
 */

const NUM = 64;
// Constantes ímpares fixas: cada uma "embaralha" o código do trecho de um jeito.
const MULT = Array.from({ length: NUM }, (_, i) => (Math.imul(0x9e3779b1, i + 1) | 1) >>> 0);
const SOMA = Array.from({ length: NUM }, (_, i) => Math.imul(0x85ebca6b, i + 7) >>> 0);

function palavras(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 2);
}

function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** MinHash dos trechos de 5 palavras (assinatura de 64 números). */
export function assinaturaDoTexto(texto: string): { assinatura: number[]; palavras: number } {
  const p = palavras(texto);
  const min = new Array<number>(NUM).fill(0xffffffff);
  if (p.length < 5) return { assinatura: [], palavras: p.length };
  for (let i = 0; i + 5 <= p.length; i++) {
    const h = fnv(p.slice(i, i + 5).join(" "));
    for (let k = 0; k < NUM; k++) {
      const v = (Math.imul(h, MULT[k]) + SOMA[k]) >>> 0;
      if (v < min[k]) min[k] = v;
    }
  }
  return { assinatura: min, palavras: p.length };
}

/** Parte de trechos iguais entre duas assinaturas (0 a 1). */
export function semelhanca(a: number[], b: number[]): number {
  if (a.length !== NUM || b.length !== NUM) return 0;
  let iguais = 0;
  for (let k = 0; k < NUM; k++) if (Number(a[k]) === Number(b[k])) iguais++;
  return iguais / NUM;
}

/**
 * Texto de um PDF, do jeito simples: abre os blocos comprimidos e junta o que
 * está entre parênteses nos comandos de texto. Não é perfeito (algumas fontes
 * vêm codificadas), mas duas cópias do mesmo PDF dão o mesmo resultado.
 */
export function textoDoPdf(dados: Uint8Array): string {
  const bruto = Buffer.from(dados).toString("latin1");
  const blocos: string[] = [];
  const re = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bruto)) && blocos.length < 2000) {
    const inicio = m.index + m[0].length;
    const fim = bruto.indexOf("endstream", inicio);
    if (fim < 0) break;
    const pedaco = dados.subarray(inicio, fim);
    try {
      blocos.push(strFromU8(unzlibSync(pedaco), true));
    } catch {
      blocos.push(bruto.slice(inicio, fim));
    }
    re.lastIndex = fim;
  }
  const saida: string[] = [];
  for (const b of blocos) {
    if (!/T[Jj]/.test(b)) continue;
    for (const t of b.matchAll(/\(((?:\\.|[^\\)])*)\)/g)) {
      saida.push(t[1].replace(/\\([nrtbf()\\])/g, (_, c: string) => ({ n: "\n", r: "", t: " ", b: "", f: "" })[c] ?? c));
    }
    saida.push(" ");
  }
  return saida.join("").slice(0, 400_000);
}

export const codigoDoArquivo = (dados: Uint8Array) => createHash("sha256").update(dados).digest("hex");

/** Guarda a impressão digital de uma entrega (depois de cada análise). */
export async function guardarImpressao(
  admin: SupabaseClient,
  e: { id: string; org_id: string; etapa_id: string; grupo_id: string },
  textos: string[],
  arquivos: Uint8Array[],
): Promise<void> {
  const { assinatura, palavras: n } = assinaturaDoTexto(textos.join("\n"));
  await admin.from("impressoes_entregas").upsert(
    {
      entrega_id: e.id,
      org_id: e.org_id,
      etapa_id: e.etapa_id,
      grupo_id: e.grupo_id,
      assinatura,
      arquivos: [...new Set(arquivos.filter((a) => a.length > 1024).map(codigoDoArquivo))],
      palavras: n,
      criada_em: new Date().toISOString(),
    },
    { onConflict: "entrega_id" },
  );
}

export type Parecida = { entregaId: string; grupo: string; percentual: number; motivo: string };

/** Outras equipes da mesma aula com entrega muito parecida com esta. */
export async function parecidasDe(supabase: SupabaseClient, entregaId: string): Promise<Parecida[]> {
  const { data: eu } = await supabase.from("impressoes_entregas").select("etapa_id, grupo_id, assinatura, arquivos, palavras").eq("entrega_id", entregaId).maybeSingle();
  if (!eu) return [];
  const { data: outras } = await supabase
    .from("impressoes_entregas")
    .select("entrega_id, grupo_id, assinatura, arquivos, palavras, entregas!inner(status, grupos(nome))")
    .eq("etapa_id", eu.etapa_id)
    .neq("grupo_id", eu.grupo_id)
    .eq("entregas.status", "recebida");
  const meus = new Set(eu.arquivos as string[]);
  const achadas: Parecida[] = [];
  for (const o of outras ?? []) {
    const grupo = (o.entregas as unknown as { grupos: { nome: string } | null }).grupos?.nome ?? "outra equipe";
    if ((o.arquivos as string[]).some((h) => meus.has(h))) {
      achadas.push({ entregaId: o.entrega_id, grupo, percentual: 100, motivo: "mandou o mesmo arquivo" });
      continue;
    }
    if (eu.palavras < 80 || o.palavras < 80) continue;
    const s = semelhanca((eu.assinatura as number[]).map(Number), (o.assinatura as number[]).map(Number));
    if (s >= 0.5) achadas.push({ entregaId: o.entrega_id, grupo, percentual: Math.round(s * 100), motivo: "texto muito parecido" });
  }
  return achadas.sort((a, b) => b.percentual - a.percentual);
}

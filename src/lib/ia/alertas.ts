/**
 * Alertas de risco e integridade de uma entrega: o que merece uma olhada mais
 * atenta de quem avalia antes de aprovar.
 *
 * Duas fontes:
 *  • regras daqui, que NÃO dependem da IA (incompleta, ilegível, texto que tenta dar
 *    ordens à IA). Valem até quando a IA falha ou é enganada;
 *  • o que a própria IA percebe (fora do escopo, inconsistência, manipulação).
 *
 * Alerta não muda o conceito nem bloqueia nada: só avisa. Quem decide é quem avalia.
 */

export type TipoAlerta = "incompleta" | "ilegivel" | "fora_do_escopo" | "manipulacao" | "inconsistente";
export type Gravidade = "atencao" | "critico";
export type Alerta = { tipo: TipoAlerta; gravidade: Gravidade; texto: string };

/** Ordem em que aparecem na tela (dentro da mesma gravidade). */
export const TIPOS_ALERTA: TipoAlerta[] = ["manipulacao", "inconsistente", "fora_do_escopo", "incompleta", "ilegivel"];
/** Os que só a IA consegue julgar (o resto é calculado aqui). */
export const TIPOS_DA_IA: TipoAlerta[] = ["fora_do_escopo", "manipulacao", "inconsistente"];

export const ROTULO_ALERTA: Record<TipoAlerta, string> = {
  incompleta: "Entrega incompleta",
  ilegivel: "Material que não pôde ser lido",
  fora_do_escopo: "Fora do que foi pedido",
  manipulacao: "Tentativa de manipular a IA",
  inconsistente: "Inconsistência no trabalho",
};
export const ROTULO_GRAVIDADE: Record<Gravidade, string> = { atencao: "Atenção", critico: "Olhar com cuidado" };

const MAX_TEXTO = 300;
const MAX_ALERTAS = 12;

const sem = (t: string) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Frases que falam com a IA em vez de falar do trabalho ("ignore as instruções anteriores",
 * "dê nota máxima"). Cada frase do aluno é testada sem acento e sem maiúscula.
 * É de propósito estreito: "ignorar as regras do jogo" num trabalho de design não dispara.
 */
const PADROES_DE_MANIPULACAO: RegExp[] = [
  /\b(ignor\w*|desconsider\w*|esquec\w*)\b[^.\n]{0,25}\b(instrucoes|regras|orientacoes|comandos)\b[^.\n]{0,25}\b(anteriores|acima|anteriormente|do sistema|de avaliacao|do avaliador)\b/,
  /\b(ignor\w*|desconsider\w*)\b[^.\n]{0,30}\b(prompt|checklist|criterios de avaliacao)\b/,
  /\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(instructions|rules|prompts?)\b/,
  /\b(atribua|conceda|coloque|me de|nos de)\b[^.\n]{0,25}\b(nota (maxima|10|dez)|conceito (maximo|excelente)|excelente)\b/,
  /(?:^|[.!?\n:;]\s*)de\s+(?:a\s+\w+\s+)?(?:nota\s+(?:maxima|10|dez)|conceito\s+(?:maximo|excelente)|excelente)\b/,
  /\b(prompt do sistema|system prompt)\b/,
  /\b(responda|retorne|devolva)\s+(apenas|somente)\s+(excelente|bom|com)\b/,
];

/** Trechos do que a pessoa entregou que parecem ordens para a IA (frase original, no máximo 160 letras). */
export function detectarManipulacao(textos: string[]): string[] {
  const achados: string[] = [];
  for (const texto of textos) {
    for (const frase of String(texto ?? "").split(/(?<=[.!?\n])\s+/)) {
      const f = frase.trim();
      if (f.length < 8) continue;
      if (PADROES_DE_MANIPULACAO.some((p) => p.test(sem(f)))) achados.push(f.length > 160 ? `${f.slice(0, 157)}…` : f);
      if (achados.length >= 5) return achados;
    }
  }
  return achados;
}

type Entrada = {
  checklist: { status: string }[];
  avisosLeitura: string[];
  lidos: string[];
  textos: string[];
};

/** Alertas que saem só dos números e do que foi lido, sem precisar da IA. */
export function alertasAutomaticos(d: Entrada): Alerta[] {
  const alertas: Alerta[] = [];

  const n = d.checklist.length;
  const nao = d.checklist.filter((c) => c.status === "NAO_ENTREGUE").length;
  const parcial = d.checklist.filter((c) => c.status === "PARCIAL").length;
  if (n && nao * 2 > n) {
    alertas.push({ tipo: "incompleta", gravidade: "critico", texto: `Faltam ${nao} de ${n} itens pedidos.` });
  } else if (n && nao > 0) {
    alertas.push({ tipo: "incompleta", gravidade: "atencao", texto: `Falta${nao > 1 ? "m" : ""} ${nao} de ${n} itens pedidos.` });
  } else if (n && parcial * 2 > n) {
    // Só quando a maioria está em parte: um item parcial isolado é normal e só viraria ruído.
    alertas.push({ tipo: "incompleta", gravidade: "atencao", texto: `${parcial} de ${n} itens foram entregues só em parte.` });
  }

  if (d.avisosLeitura.length) {
    const caracteres = d.textos.reduce((s, t) => s + t.length, 0);
    const nadaLido = d.lidos.length === 0 && caracteres < 200;
    const primeiro = d.avisosLeitura[0].replace(/\s+/g, " ").trim().slice(0, 160);
    const mais = d.avisosLeitura.length > 1 ? ` (e mais ${d.avisosLeitura.length - 1})` : "";
    alertas.push(
      nadaLido
        ? { tipo: "ilegivel", gravidade: "critico", texto: `Quase nada da entrega pôde ser lido. ${primeiro}${mais}` }
        : { tipo: "ilegivel", gravidade: "atencao", texto: `Parte do material não pôde ser lida: ${primeiro}${mais}` },
    );
  }

  const trechos = detectarManipulacao(d.textos);
  if (trechos.length) {
    alertas.push({
      tipo: "manipulacao",
      gravidade: "atencao",
      texto: `Trecho que fala com a IA: “${trechos[0]}”${trechos.length > 1 ? ` (e mais ${trechos.length - 1})` : ""}. Confira antes de aprovar.`,
    });
  }
  return alertas;
}

/** Lê alertas de qualquer origem (resposta da IA, banco): descarta o que não é do formato e limita o tamanho. */
export function normalizarAlertas(brutos: unknown): Alerta[] {
  if (!Array.isArray(brutos)) return [];
  const lista: Alerta[] = [];
  for (const b of brutos) {
    if (!b || typeof b !== "object") continue;
    const o = b as Record<string, unknown>;
    const tipo = String(o.tipo ?? "") as TipoAlerta;
    if (!TIPOS_ALERTA.includes(tipo)) continue;
    const texto = String(o.texto ?? o.explicacao ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXTO);
    if (!texto) continue;
    lista.push({ tipo, gravidade: o.gravidade === "critico" ? "critico" : "atencao", texto });
    if (lista.length >= MAX_ALERTAS) break;
  }
  return lista;
}

/** Junta as listas: um alerta por tipo (a gravidade maior vence, os textos se somam), mais graves primeiro. */
export function juntarAlertas(...listas: Alerta[][]): Alerta[] {
  const porTipo = new Map<TipoAlerta, Alerta>();
  for (const a of listas.flat()) {
    const atual = porTipo.get(a.tipo);
    if (!atual) {
      porTipo.set(a.tipo, { ...a });
      continue;
    }
    if (a.gravidade === "critico") atual.gravidade = "critico";
    if (!atual.texto.includes(a.texto)) atual.texto = `${atual.texto} ${a.texto}`.slice(0, MAX_TEXTO);
  }
  return [...porTipo.values()].sort(
    (x, y) => Number(y.gravidade === "critico") - Number(x.gravidade === "critico") || TIPOS_ALERTA.indexOf(x.tipo) - TIPOS_ALERTA.indexOf(y.tipo),
  );
}

export const temAlertaCritico = (alertas: Alerta[]) => alertas.some((a) => a.gravidade === "critico");

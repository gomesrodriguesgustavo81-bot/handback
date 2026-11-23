/**
 * Triagem dos e-mails recebidos — as mesmas regras do protótipo (03_Gmail):
 *
 *  1. Assunto COMEÇANDO com a etiqueta (ex.: [ENTREGA]) → entrega.
 *  2. Remetente precisa estar cadastrado num grupo. (Se não estiver, mas o
 *     assunto tiver a etiqueta e o nome do grupo, vai para "Para confirmar".)
 *  3. Etapa pelo número no assunto; se não houver, pela data do envio.
 *     Depois do prazo → "com atraso" (calculado no banco).
 *  4. Resposta numa conversa que já tem entrega só conta se trouxer arquivo
 *     ou link novo ("Obrigado, professor!" é ignorado).
 *  5. Mensagens de pessoas da própria empresa não contam (a não ser um
 *     encaminhamento manual de uma mensagem de alguém do grupo).
 *  6. Assunto fora do padrão + anexo/link → "Para confirmar" (no modo
 *     automático, vira entrega direto).
 *  7. Assuntos com termos como "bolsista", "contrato", "documento"… são
 *     ignorados (documentos pessoais nunca viram entrega).
 */

export type EmailParaTriagem = {
  deEmail: string;
  assunto: string;
  texto: string;
  html: string;
  enviadoEm: Date;
  respondeA: string[];
  quantidadeDeAnexos: number;
};

export type EtapaParaTriagem = { id: string; numero: number; titulo?: string; recebe_de: string | null; recebe_ate: string | null };
export type GrupoParaTriagem = { id: string; nome: string; emails: string[] };

export type ContextoTriagem = {
  etiqueta: string;
  modo: "confirmar" | "automatico";
  assuntosIgnorar: string;
  palavraEtapa: string;
  etapas: EtapaParaTriagem[];
  grupos: GrupoParaTriagem[];
  /** E-mails das pessoas da empresa (professores, gestores…). */
  emailsDaEquipe: string[];
  /** Message-IDs de e-mails desta empresa que já viraram entrega. */
  mensagensComEntrega: string[];
};

export type ResultadoTriagem = {
  status: "entrega" | "confirmar" | "ignorado";
  motivo: string;
  avisos: string[];
  etapaId: string | null;
  grupoId: string | null;
  links: string[];
};

const REMETENTE_GMAIL_ENCAMINHAMENTO = "forwarding-noreply@google.com";

/** "Ação: Entrega!" → "acao entrega" (sem acentos, minúsculas, só letras e números). */
export function normalizar(t: string): string {
  return String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Como normalizar, com espaços nas pontas: facilita procurar palavras inteiras. */
export function simplificar(t: string): string {
  return " " + normalizar(t).replace(/[^a-z0-9º°]+/g, " ").replace(/\s+/g, " ").trim() + " ";
}

/** Data de Brasília ("AAAA-MM-DD") de um instante. */
export function dataEmBrasilia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

/** Links do corpo do e-mail (texto e html), sem repetição. */
export function extrairLinks(texto: string, html: string): string[] {
  const doHtml = [...String(html ?? "").matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const doTexto = String(texto ?? "").match(/https?:\/\/[^\s"'<>)\]]+/g) ?? [];
  const vistos = new Set<string>();
  const links: string[] = [];
  for (const bruto of [...doTexto, ...doHtml]) {
    const l = bruto.replace(/&amp;/g, "&").replace(/[.,;:!?]+$/, "");
    if (!/^https?:\/\//i.test(l)) continue;
    if (/unsubscribe|descadastr|mailto:|google\.com\/mail|accounts\.google\.com|support\.google\.com/i.test(l)) continue;
    const chave = l.replace(/[?#].*$/, "");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    links.push(l);
  }
  return links.slice(0, 50);
}

/** Autor original citado num encaminhamento manual ("De: Fulano <x@y>"). */
export function autorOriginal(texto: string): string | null {
  const bloco = String(texto ?? "").split(/-{5,}\s*(Forwarded message|Mensagem encaminhada)\s*-{5,}/i)[2] ?? String(texto ?? "");
  const m = bloco.match(/^\s*(De|From|Remetente)\s*:\s*(.+)$/im);
  if (!m) return null;
  const email = m[2].match(/[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/);
  return email ? email[0].toLowerCase() : null;
}

function interpretarAssunto(assunto: string, ctx: ContextoTriagem) {
  const avisos: string[] = [];
  const simp = simplificar(assunto);

  // 1) Etiqueta: precisa estar NO COMEÇO (depois de RE:/ENC:/FW:).
  const pre = simplificar(ctx.etiqueta).trim();
  const inicio = simp.replace(/^ ((re|res|enc|fw|fwd|tr) )+/, " ");
  const temPrefixo = !pre || inicio.startsWith(" " + pre + " ");

  // 2) Número da etapa ("Aula 3", "Etapa 3", "Ciclo nº 3"…). "Aula 11/11" é data, não número.
  const palavras = [...new Set(["aula", "etapa", simplificar(ctx.palavraEtapa).trim()])].filter(Boolean).join("|");
  let numero: number | null = null;
  const ehData = new RegExp(`(${palavras})\\s*(n[º°o.]?\\s*)?0*\\d{1,2}\\s*[\\/.\\-]\\s*\\d{1,2}`, "i").test(normalizar(assunto));
  if (!ehData) {
    const m = simp.match(new RegExp(` (?:${palavras}) ?(?:n[º°o]? ?)?0*(\\d{1,3}) `));
    numero = m ? Number(m[1]) : null;
  }
  const etapa = numero === null ? null : (ctx.etapas.find((e) => e.numero === numero) ?? null);

  // 3) Grupo citado no assunto (o nome mais longo que aparecer inteiro).
  let grupo: GrupoParaTriagem | null = null;
  let tamanho = 0;
  for (const g of ctx.grupos) {
    const n = simplificar(g.nome).trim();
    if (n && simp.includes(" " + n + " ") && n.length > tamanho) {
      grupo = g;
      tamanho = n.length;
    }
  }
  grupo ??= grupoPorApelido(assunto, ctx.grupos);

  return { temPrefixo, numero, etapa, grupo, avisos };
}

/** Grupo pelo "nome curto" (a parte antes do " - "), se só um grupo tiver esse apelido. */
function grupoPorApelido(assunto: string, grupos: GrupoParaTriagem[]): GrupoParaTriagem | null {
  const simp = simplificar(assunto);
  const genericas = ["grupo", "equipe", "time", "cliente"];
  const apelidos = grupos.map((g) => {
    const curto = String(g.nome).split(/\s+[-–—|(]\s*/)[0];
    const palavras = simplificar(curto).trim().split(" ").filter((w) => w.length >= 3 && !genericas.includes(w));
    return { g, chaves: [...new Set([simplificar(curto).trim(), ...palavras])] };
  });
  const contagem = new Map<string, number>();
  for (const a of apelidos) for (const k of a.chaves) contagem.set(k, (contagem.get(k) ?? 0) + 1);
  const achados = apelidos.filter((a) => a.chaves.some((k) => k.length >= 3 && contagem.get(k) === 1 && simp.includes(" " + k + " ")));
  return achados.length === 1 ? achados[0].g : null;
}

export function triar(email: EmailParaTriagem, ctx: ContextoTriagem): ResultadoTriagem {
  const links = extrairLinks(email.texto, email.html);
  const avisos: string[] = [];
  const saida = (status: ResultadoTriagem["status"], motivo: string, etapaId: string | null = null, grupoId: string | null = null) => ({
    status,
    motivo,
    avisos,
    etapaId,
    grupoId,
    links,
  });

  let rem = String(email.deEmail ?? "").toLowerCase().trim();
  if (!rem) return saida("ignorado", "sem remetente");

  // Confirmação do Gmail ao ligar o encaminhamento: precisa de atenção humana.
  if (rem === REMETENTE_GMAIL_ENCAMINHAMENTO) {
    avisos.push("Abra este e-mail e use o código ou o link para confirmar o encaminhamento no Gmail.");
    return saida("confirmar", "confirmação de encaminhamento do Gmail");
  }

  const emailParaGrupo = new Map<string, GrupoParaTriagem>();
  for (const g of ctx.grupos) for (const e of g.emails) if (!emailParaGrupo.has(e.toLowerCase())) emailParaGrupo.set(e.toLowerCase(), g);

  // Regra 5: mensagens da própria empresa não contam, salvo encaminhamento manual de alguém do grupo.
  if (ctx.emailsDaEquipe.map((e) => e.toLowerCase()).includes(rem)) {
    const orig = autorOriginal(email.texto);
    const ehEncaminhado = /^\s*(fwd?|enc|tr|encaminhada)\s*:/i.test(String(email.assunto ?? "").replace(/^\s*(re|res)\s*:\s*/i, ""));
    if (!(ehEncaminhado && orig && emailParaGrupo.has(orig))) return saida("ignorado", "mensagem de alguém da própria empresa");
    avisos.push(`Encaminhado por ${rem} (autor original: ${orig}).`);
    rem = orig;
  }

  const temConteudo = email.quantidadeDeAnexos > 0 || links.length > 0;
  const assunto = interpretarAssunto(email.assunto, ctx);
  const variacao = /^ ((re|res|enc|fw|fwd|tr) )*entreg[a-z]* /.test(simplificar(email.assunto));
  const etiqueta = assunto.temPrefixo || (variacao && temConteudo);

  // Regra 7: assuntos que claramente não são entrega.
  if (!etiqueta) {
    const termos = ctx.assuntosIgnorar.split(",").map((x) => normalizar(x)).filter(Boolean);
    const achou = termos.find((x) => normalizar(email.assunto).includes(x));
    if (achou) return saida("ignorado", `assunto contém "${achou}"`);
  }

  // Regra 2: grupo pelo remetente; se não estiver cadastrado, pelo assunto.
  let grupo = emailParaGrupo.get(rem) ?? null;
  const cadastrado = grupo !== null;
  if (!grupo) {
    grupo = assunto.grupo;
    if (!temConteudo && !etiqueta) return saida("ignorado", "remetente não é de nenhum grupo");
    if (!etiqueta && !grupo) return saida("ignorado", "remetente não é de nenhum grupo");
    avisos.push(
      `O remetente ${rem} não está cadastrado` +
        (grupo ? `; grupo sugerido pelo assunto: ${grupo.nome}` : "; escolha o grupo") +
        ". Para não acontecer de novo, acrescente este e-mail no cadastro.",
    );
  } else if (assunto.grupo && assunto.grupo.id !== grupo.id) {
    avisos.push(`O assunto cita "${assunto.grupo.nome}", mas o remetente é de "${grupo.nome}".`);
  }

  // Regra 4: resposta numa conversa com entrega, sem nada novo.
  if (email.respondeA.some((id) => ctx.mensagensComEntrega.includes(id)) && !temConteudo) {
    return saida("ignorado", "resposta na conversa, sem arquivo ou link novo");
  }

  // Regra 3: etapa pelo número; senão, pela data. Na dúvida, não chuta.
  const dia = dataEmBrasilia(email.enviadoEm);
  let etapa = assunto.etapa;
  let duvida = "";
  if (!etapa) {
    if (assunto.numero !== null) duvida = `O assunto cita o número ${assunto.numero}, que não está cadastrado.`;
    const abertas = ctx.etapas.filter((e) => e.recebe_ate && (!e.recebe_de || e.recebe_de <= dia) && dia <= e.recebe_ate);
    etapa = abertas[0] ?? null;
    if (abertas.length > 1) {
      // Mais de uma etapa recebendo na mesma data: tenta pelo título citado no
      // assunto; se não der para saber, vai para a caixa (não chuta).
      const assuntoSimp = simplificar(email.assunto);
      const pelo = abertas.filter((e) => {
        const t = simplificar(e.titulo ?? "").trim();
        return t.length >= 3 && assuntoSimp.includes(" " + t + " ");
      });
      if (pelo.length === 1) etapa = pelo[0];
      else if (!duvida)
        duvida = `Há ${abertas.length} etapas recebendo nesta data (${abertas.map((e) => `nº ${e.numero}`).join(", ")}): escolha a qual esta entrega pertence.`;
    }
    if (!etapa) {
      const passadas = ctx.etapas
        .filter((e) => e.recebe_ate && e.recebe_ate < dia)
        .sort((a, b) => (a.recebe_ate! < b.recebe_ate! ? 1 : -1));
      etapa = passadas[0] ?? null;
      if (etapa && !duvida) duvida = `Enviada fora do prazo de todas as etapas: confira (sugestão: nº ${etapa.numero}).`;
    }
  }
  if (etapa?.recebe_de && dia < etapa.recebe_de) avisos.push("Enviada antes do início do período de recebimento.");

  const etapaId = etapa?.id ?? null;
  const grupoId = grupo?.id ?? null;
  const pendente = (motivo: string, aviso?: string) => {
    if (aviso) avisos.unshift(aviso);
    return saida("confirmar", motivo, etapaId, grupoId);
  };

  if (!etapa) {
    if (etiqueta || temConteudo) return pendente("etapa não identificada", "Não foi possível saber a que etapa este e-mail se refere.");
    return saida("ignorado", "sem etapa, sem etiqueta e sem conteúdo");
  }
  if (!cadastrado) return pendente("remetente não cadastrado");
  if (duvida && (etiqueta || temConteudo)) return pendente("etapa incerta", duvida);
  if (etiqueta) return saida("entrega", variacao && !assunto.temPrefixo ? 'assunto começa com "Entrega…"' : "assunto no padrão", etapaId, grupoId);
  if (temConteudo) {
    if (ctx.modo === "automatico") return saida("entrega", "fora do padrão, com conteúdo (modo automático)", etapaId, grupoId);
    return pendente("fora do padrão, com anexo ou link", `Assunto fora do padrão: "${email.assunto}".`);
  }
  return saida("ignorado", "conversa (sem etiqueta, sem anexo ou link)");
}

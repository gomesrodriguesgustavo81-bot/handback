/**
 * =====================================================================
 *  Arquivo 03_Gmail — PASSO 3
 *  Busca as entregas no seu Gmail e registra na aba Entregas (sem IA).
 *
 *  REGRAS (decididas com você):
 *   1. Assunto COMEÇANDO com a etiqueta (ex.: [ENTREGA]) → entrega.
 *   2. Remetente precisa ser integrante cadastrado.
 *      (Se não for, mas o assunto tiver a etiqueta e o nome da equipe,
 *       vira "Possível entrega" para você confirmar.)
 *   3. Aula pelo número no assunto; se não houver, pela data do envio.
 *      Depois do prazo → entra marcada "com atraso".
 *   4. Numa conversa que já tem entrega, só conta como REENVIO se trouxer
 *      anexo ou link novo ("Obrigado, professor!" é ignorado).
 *   5. Mensagens suas e do professor nunca contam.
 *   6. Assunto fora do padrão + anexo/link → "Possível entrega" (você
 *      decide no app). Modo AUTOMÁTICO (Config) aceita direto.
 *
 *  No Gmail: NADA é apagado, movido ou marcado como lido. Só aplica o
 *  marcador "Consultoria/Entregas" nas entregas reconhecidas.
 * =====================================================================
 */

const VERSAO_GMAIL = 'Passo 3.3 · 2026-11-19';
const MARCADOR = 'Consultoria/Entregas';
const PADRAO_IGNORAR = 'cadastro, bolsista, contrat, comprovante, document, fatura, holerite, ficha, pagamento, cronograma de pagamento, lembrete';
const TAMANHO_MIN_IMAGEM_CORPO = 30 * 1024; // imagens coladas no corpo menores que isso são logos/assinaturas

/** Status usados na coluna Status da aba Entregas. */
const ST = {
  RECEBIDA: 'Recebida',
  POSSIVEL: 'Possível entrega (confirmar)',
  IGNORADA: 'Ignorada',
  SUBSTITUIDA: 'Substituída'
};

/* ------------------------------------------------------------------ */
/*  MENU E APP                                                         */
/* ------------------------------------------------------------------ */

/** 📥 Menu da planilha. */
function buscarEntregasMenu() {
  try {
    const r = buscarEntregas_('Planilha');
    alerta_('📥 Busca concluída', r.mensagem);
  } catch (e) {
    alerta_('❌ Não foi possível buscar', String(e.message || e));
  }
}

/** 📥 Chamado pelo app. */
function apiBuscarEntregas() {
  return api_(function () { return buscarEntregas_('App'); });
}

/** Lista as "possíveis entregas" que aguardam sua decisão. */
function apiTriagem() {
  return api_(function () {
    return lerAba_(ESQUEMA.ENTREGAS)
      .filter(function (e) { return e.STATUS === ST.POSSIVEL; })
      .map(function (e) {
        return {
          id: String(e.ID), equipe: String(e.EQUIPE || '(não identificada)'), aula: String(e.AULA || ''),
          remetente: String(e.REMETENTE || ''), assunto: String(e.ASSUNTO || ''),
          enviadoEm: fmtData_(e.DATA_ENVIO, 'dd/MM HH:mm'), arquivos: String(e.ARQUIVOS || ''),
          avisos: String(e.AVISOS || ''), link: linkConversa_(e.ID_CONVERSA)
        };
      });
  });
}

/** Aceita ou ignora uma possível entrega. decisao = 'aceitar' | 'ignorar' */
function apiDecidirTriagem(id, decisao) {
  return api_(function () {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('Outra operação está em andamento. Tente de novo em instantes.');
    try {
      const entregas = lerAba_(ESQUEMA.ENTREGAS);
      const e = entregas.find(function (x) { return String(x.ID) === String(id); });
      if (!e) throw new Error('Entrega não encontrada. Atualize a tela.');
      if (e.STATUS !== ST.POSSIVEL) throw new Error('Esta entrega já foi decidida.');
      if (decisao === 'aceitar') {
        if (!e.ID_EQUIPE) throw new Error('Não foi possível identificar a equipe. Cadastre o e-mail do remetente na aba Equipes e busque de novo.');
        if (!e.ID_AULA) throw new Error('Não foi possível identificar a aula pela data. Confira as datas na aba Aulas.');
        escreverCampos_(e._linha, { STATUS: ST.RECEBIDA, ATUALIZADO_EM: new Date() });
        e.STATUS = ST.RECEBIDA;
        substituirAnteriores_(entregas, e);
        marcarNoGmail_(e.ID_CONVERSA);
        registrarAcao_('Você (app)', 'Possível entrega aceita', e.AULA, e.EQUIPE, e.ASSUNTO);
      } else {
        escreverCampos_(e._linha, { STATUS: ST.IGNORADA, ATUALIZADO_EM: new Date() });
        registrarAcao_('Você (app)', 'Possível entrega ignorada', e.AULA, e.EQUIPE, e.ASSUNTO);
      }
      return { ok: true };
    } finally {
      lock.releaseLock();
    }
  });
}

/* ------------------------------------------------------------------ */
/*  BUSCA                                                              */
/* ------------------------------------------------------------------ */

/**
 * Busca no Gmail e registra o que for entrega.
 * @param {string} quem - quem disparou (para a aba Ações)
 * @return {{novas:number, possiveis:number, mensagem:string}}
 */
function buscarEntregas_(quem) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Outra busca está em andamento. Tente de novo em instantes.');
  try {
    garantirParametro_('ASSUNTOS_IGNORAR', PADRAO_IGNORAR,
      'Palavras no assunto que indicam que o e-mail NÃO é entrega (separadas por vírgula). Valem só quando o assunto não começa com a etiqueta ENTREGA.');
    garantirParametro_('MODO_ENTREGA', 'CONFIRMAR',
      'CONFIRMAR = assunto fora do padrão (com anexo/link) espera sua confirmação no app. AUTOMÁTICO = aceita direto.');
    const cfg = lerConfig_();
    const equipes = lerAba_(ESQUEMA.EQUIPES);
    const aulas = lerAba_(ESQUEMA.AULAS).filter(function (a) { return a.RECEBE_DE instanceof Date && a.RECEBE_ATE instanceof Date; });
    if (!equipes.length) throw new Error('Cadastre as equipes antes de buscar.');
    if (!aulas.length) throw new Error('Cadastre pelo menos uma aula com as datas "Recebe entregas de/até".');

    const entregas = lerAba_(ESQUEMA.ENTREGAS);
    const contexto = montarContextoBusca_(cfg, equipes, aulas, entregas);
    const mensagens = lerMensagensDoGmail_(equipes, aulas, cfg, contexto.excluidos, false);
    let novas = 0, possiveis = 0;
    const avisosGerais = [];

    mensagens.forEach(function (info) {
      const r = classificarMensagem_(info, contexto);
      if (r.acao === 'IGNORAR') return;

      const status = r.acao === 'ENTREGA' ? ST.RECEBIDA : ST.POSSIVEL;
      const reg = {
        ID: 'D' + Utilities.formatDate(info.data, 'GMT', 'yyMMddHHmmss') + '-' + info.id.slice(-4),
        ID_AULA: r.aula ? r.aula.ID_AULA : '',
        AULA: r.aula ? 'Aula ' + r.aula.NUMERO + ' — ' + r.aula.TITULO : '',
        PEDIDO: r.aula ? textoPedido_(r.aula) : '',
        ID_EQUIPE: r.equipe ? r.equipe.ID_EQUIPE : '',
        EQUIPE: r.equipe ? r.equipe.NOME : '',
        REMETENTE: info.remetente,
        DATA_ENVIO: info.data,
        ATRASO: r.atraso ? 'SIM' : 'NÃO',
        ASSUNTO: info.assunto,
        ID_EMAIL: info.id,
        ID_CONVERSA: info.idConversa,
        ARQUIVOS: info.arquivos.concat(info.links.map(function (l) { return 'link: ' + l; }), (info.outrosLinks || []).map(function (l) { return 'link externo: ' + l; })).join('; '),
        AVISOS: r.avisos.join(' | '),
        STATUS: status,
        ATUALIZADO_EM: new Date()
      };
      inserirLinha_(ESQUEMA.ENTREGAS, reg);
      reg._linha = planilha_().getSheetByName(ESQUEMA.ENTREGAS.nome).getLastRow();
      entregas.push(reg);
      contexto.registradas.add(info.id);
      contexto.conversasComEntrega.add(info.idConversa);

      if (status === ST.RECEBIDA) {
        novas++;
        substituirAnteriores_(entregas, reg);
        marcarNoGmail_(info.idConversa);
        registrarAcao_(quem, 'Entrega recebida', reg.AULA, reg.EQUIPE, info.assunto + (r.atraso ? ' (com atraso)' : ''));
      } else {
        possiveis++;
        registrarAcao_(quem, 'Possível entrega para confirmar', reg.AULA, reg.EQUIPE, info.assunto);
      }
      if (r.avisos.length) avisosGerais.push('• ' + (reg.EQUIPE || info.remetente) + ': ' + r.avisos[0]);
    });

    registrarAcao_(quem, 'Busca de entregas', '', '', novas + ' nova(s), ' + possiveis + ' para confirmar');
    let msg = '📥 ' + novas + ' entrega(s) nova(s) registrada(s).';
    if (possiveis) msg += '\n🟡 ' + possiveis + ' possível(is) entrega(s) fora do padrão: confirme no app (seção "Para confirmar").';
    if (!novas && !possiveis) msg = 'Nenhuma entrega nova encontrada. ✅';
    if (avisosGerais.length) msg += '\n\nAvisos:\n' + avisosGerais.slice(0, 10).join('\n');
    return { novas: novas, possiveis: possiveis, mensagem: msg };
  } finally {
    lock.releaseLock();
  }
}

/** Contexto usado para classificar (também pelo raio-x da busca). */
function montarContextoBusca_(cfg, equipes, aulas, entregas) {
  return {
    cfg: cfg,
    equipes: equipes,
    aulas: aulas,
    emailParaEquipe: mapaEmails_(equipes),
    registradas: new Set(entregas.map(function (e) { return String(e.ID_EMAIL); })),
    conversasComEntrega: new Set(entregas
      .filter(function (e) { return e.STATUS !== ST.IGNORADA; })
      .map(function (e) { return String(e.ID_CONVERSA); })),
    excluidos: [Session.getEffectiveUser().getEmail()].concat(extrairEmails_(cfg.EMAIL_PROFESSOR), extrairEmails_(cfg.EMAIL_ENTREGAS))
      .map(function (x) { return String(x || '').toLowerCase(); }).filter(function (x, i, a) { return x && a.indexOf(x) === i; })
  };
}

/**
 * Lê do Gmail as mensagens candidatas (só o necessário, já resumido).
 * @param {boolean} amplo - true = TODOS os e-mails do período (raio-x da busca)
 */
function lerMensagensDoGmail_(equipes, aulas, cfg, excluidos, amplo) {
  const inicio = new Date(Math.min.apply(null, aulas.map(function (a) { return a.RECEBE_DE.getTime(); })) - 86400000);
  const todos = [];
  equipes.forEach(function (e) { extrairEmails_(e.EMAILS).forEach(function (x) { todos.push(x); }); });
  const etiqueta = String(cfg.ASSUNTO_PREFIXO || '').replace(/[\[\]{}()"':]/g, ' ').trim();
  const partes = [];
  if (todos.length) partes.push('from:(' + todos.join(' OR ') + ')');
  if (etiqueta) partes.push('subject:(' + etiqueta + ')');
  // Encaminhados por você ou pelo professor ("Fwd:", "ENC:", "TR:")
  if ((excluidos || []).length) partes.push('(from:(' + excluidos.join(' OR ') + ') subject:(fwd OR enc OR tr OR encaminhada))');
  const periodo = ' after:' + Utilities.formatDate(inicio, 'GMT', 'yyyy/MM/dd') + ' -in:trash -in:spam';
  const consulta = amplo ? periodo.trim() : '(' + partes.join(' OR ') + ')' + periodo;

  const saida = [];
  const paginas = amplo ? 2 : 5;
  for (let pag = 0; pag < paginas; pag++) {
    const threads = GmailApp.search(consulta, pag * 100, 100);
    threads.forEach(function (t) {
      t.getMessages().forEach(function (m) { saida.push(resumoMensagem_(m, t)); });
    });
    if (threads.length < 100) break;
  }
  // Ordem cronológica: o reenvio mais novo vence
  return saida.sort(function (a, b) { return a.data - b.data; });
}

/** Resumo de uma mensagem: remetente, assunto, anexos, links (Google e outros), autor original se encaminhada. */
function resumoMensagem_(m, t) {
  const plano = m.getPlainBody() || '';
  const html = m.getBody() || '';
  const corpo = plano + '\n' + html;
  const anexos = m.getAttachments({ includeInlineImages: false, includeAttachments: true });
  let imagensNoCorpo = 0;
  try {
    m.getAttachments({ includeInlineImages: true, includeAttachments: false }).forEach(function (a) {
      if (/^image\//i.test(a.getContentType()) && a.getSize() >= TAMANHO_MIN_IMAGEM_CORPO) imagensNoCorpo++;
    });
  } catch (e) { /* sem imagens no corpo */ }
  const hrefs = (html.match(/href=["']([^"']+)["']/gi) || []).map(function (h) { return h.replace(/^href=["']|["']$/gi, ''); }).join('\n');
  return {
    id: m.getId(),
    idConversa: t.getId(),
    remetente: extrairEmails_(m.getFrom())[0] || '',
    data: m.getDate(),
    assunto: m.getSubject() || '',
    arquivos: anexos.map(function (a) { return a.getName(); }),
    links: linksGoogle_(corpo),
    outrosLinks: linksExternos_(plano + '\n' + hrefs),
    imagensNoCorpo: imagensNoCorpo,
    encaminhadoDe: autorOriginal_(plano)
  };
}

/** Links de entrega fora do Google (Figma, Canva, Miro, Notion, YouTube, OneDrive…). */
function linksExternos_(texto) {
  const ruido = /(google\.com\/(maps|url|calendar)|accounts\.google|support\.google|mail\.google|unsubscribe|descadastr|whatsapp\.com|wa\.me|instagram\.com|facebook\.com|linkedin\.com\/in|aka\.ms|outlook\.|office\.com\/?$|mailto:)/i;
  const achados = String(texto || '').match(/https?:\/\/[^\s"'<>)\]]+/g) || [];
  const unicos = [];
  achados.forEach(function (l) {
    if (/(docs|drive)\.google\.com/.test(l) || ruido.test(l)) return;
    const k = l.replace(/[?#].*$/, '').replace(/[.,;]+$/, '');
    if (unicos.indexOf(k) === -1) unicos.push(k);
  });
  return unicos;
}

/** Em e-mails encaminhados, o e-mail de quem escreveu a mensagem original. */
function autorOriginal_(texto) {
  const bloco = String(texto || '').split(/-{3,}\s*(Forwarded message|Mensagem encaminhada|Mensaje reenviado|Original Message|Mensagem original)\s*-{3,}/i)[2];
  if (!bloco) return '';
  const m = bloco.match(/^\s*(De|From|Remetente)\s*:\s*(.+)$/im);
  return m ? (extrairEmails_(m[2])[0] || '') : '';
}

/* ------------------------------------------------------------------ */
/*  CLASSIFICAÇÃO (separada para poder ser testada)                    */
/* ------------------------------------------------------------------ */

/**
 * Decide o que fazer com uma mensagem.
 * @return {{acao:'ENTREGA'|'POSSIVEL'|'IGNORAR', motivo:string, equipe:Object|null,
 *           aula:Object|null, atraso:boolean, avisos:string[]}}
 */
function classificarMensagem_(info, ctx) {
  const ignorar = function (motivo) { return { acao: 'IGNORAR', motivo: motivo, equipe: null, aula: null, atraso: false, avisos: [] }; };
  let rem = String(info.remetente || '').toLowerCase();
  if (ctx.registradas.has(String(info.id))) return ignorar('já registrada');
  if (!rem) return ignorar('sem remetente');

  const avisos = [];
  // Encaminhado por você/professor: vale o autor original, se for de uma equipe
  if (ctx.excluidos.indexOf(rem) !== -1) {
    const orig = String(info.encaminhadoDe || '').toLowerCase();
    const ehEncaminhado = /^\s*(fwd?|enc|tr|encaminhada)\s*:/i.test(String(info.assunto || '').replace(/^\s*(re|res)\s*:\s*/i, ''));
    if (!(ehEncaminhado && orig && ctx.emailParaEquipe[orig])) return ignorar('mensagem sua ou do professor');
    avisos.push('Encaminhado por ' + rem + ' (autor original: ' + orig + ').');
    rem = orig;
  }

  // Conteúdo: anexos, links do Google, outros links, imagens coladas no corpo
  const outros = info.outrosLinks || [];
  const imgs = info.imagensNoCorpo || 0;
  const temConteudo = info.arquivos.length > 0 || info.links.length > 0 || outros.length > 0 || imgs > 0;

  // Etiqueta: "[ENTREGA] …" no começo; também aceita "Entregas", "Entregáveis"… (se houver conteúdo)
  const assunto = interpretarAssunto_(info.assunto, ctx.cfg.ASSUNTO_PREFIXO, ctx.equipes, ctx.aulas);
  // "Aula 11/11/2026" é uma DATA, não a "Aula 11": desconsidera esse número
  if (/aula\s*(n[º°o.]?\s*)?0*\d{1,2}\s*[\/.\-]\s*\d{1,2}/i.test(String(info.assunto || ''))) {
    assunto.numeroAula = null;
    assunto.aula = null;
    assunto.avisos = assunto.avisos.filter(function (a) { return !/Aula \d+" cadastrada|Não existe "Aula/.test(a); });
  }
  const variacao = /^ ((re|res|enc|fw|fwd|tr) )*entreg[a-z]* /.test(simplificar_(info.assunto));
  const etiqueta = assunto.temPrefixo || (variacao && temConteudo);

  // Assuntos que claramente não são entrega (cadastro, contrato, documentos…)
  if (!etiqueta) {
    const termos = String(ctx.cfg.ASSUNTOS_IGNORAR || PADRAO_IGNORAR).split(',').map(function (x) { return normalizar_(x); }).filter(String);
    const simp = normalizar_(info.assunto);
    const achou = termos.find(function (x) { return simp.indexOf(x) !== -1; });
    if (achou) return ignorar('assunto contém "' + achou + '" (Config › ASSUNTOS_IGNORAR)');
  }

  if (imgs && !info.arquivos.length) avisos.push(imgs + ' imagem(ns) colada(s) no corpo do e-mail.');
  if (outros.length && !info.links.length && !info.arquivos.length) {
    avisos.push('Entrega por link externo (' + outros.slice(0, 2).join(', ') + '): a IA não consegue abrir, só verá o texto do e-mail.');
  }

  // Equipe: pelo remetente; se não estiver cadastrado, pelo assunto (nome completo ou nome curto)
  let equipe = ctx.emailParaEquipe[rem] || null;
  const cadastrado = !!equipe;
  if (!equipe) {
    equipe = assunto.equipe || equipePorApelido_(info.assunto, ctx.equipes);
    if (!temConteudo || (!etiqueta && !equipe)) return ignorar('remetente não é de nenhuma equipe');
    avisos.push('Remetente ' + rem + ' NÃO está cadastrado' + (equipe ? '; equipe sugerida pelo assunto: ' + equipe.NOME : '; escolha a equipe') +
      '. Para não acontecer de novo, acrescente este e-mail na aba Equipes.');
  } else if (assunto.equipe && assunto.equipe.ID_EQUIPE !== equipe.ID_EQUIPE) {
    avisos.push('O assunto cita "' + assunto.equipe.NOME + '", mas o remetente é da equipe "' + equipe.NOME + '".');
  }

  // Resposta numa conversa que já tem entrega: só vale com arquivo/link novo
  if (ctx.conversasComEntrega.has(String(info.idConversa)) && !temConteudo) return ignorar('resposta na conversa, sem arquivo novo');

  // Aula: número no assunto; senão, pela data. Na dúvida, NÃO chuta.
  const t = info.data.getTime();
  let aula = assunto.aula;
  let duvida = '';
  if (!aula) {
    aula = ctx.aulas.find(function (a) { return a.RECEBE_DE.getTime() <= t && t <= a.RECEBE_ATE.getTime() + 86399999; }) || null;
    if (assunto.numeroAula !== null) duvida = 'O assunto cita a Aula ' + assunto.numeroAula + ', que não está cadastrada (ou está sem datas) na aba Aulas.';
    if (!aula) {
      const passadas = ctx.aulas.filter(function (a) { return a.RECEBE_DE.getTime() <= t; })
        .sort(function (a, b) { return b.RECEBE_DE - a.RECEBE_DE; });
      aula = passadas[0] || null;
      if (aula && !duvida) duvida = 'Enviada fora do prazo de todas as aulas: confira a aula (sugestão: Aula ' + aula.NUMERO + ').';
    }
  }
  if (!aula) return ignorar('enviada antes do período de qualquer aula');
  const atraso = t > aula.RECEBE_ATE.getTime() + 86399999;
  if (t < aula.RECEBE_DE.getTime()) avisos.push('Enviada antes do início do período desta aula.');
  avisos.push.apply(avisos, assunto.avisos.filter(function (a) { return !/não é tratado como entrega|Nome da equipe não reconhecido/.test(a); }));

  const base = { equipe: equipe, aula: aula, atraso: atraso, avisos: avisos };
  const pendente = function (motivo, aviso) { if (aviso) base.avisos.unshift(aviso); return Object.assign(base, { acao: 'POSSIVEL', motivo: motivo }); };

  if (!cadastrado) return pendente('remetente não cadastrado');
  if (duvida && (etiqueta || temConteudo)) return pendente('aula incerta', duvida);
  if (etiqueta) return Object.assign(base, { acao: 'ENTREGA', motivo: variacao && !assunto.temPrefixo ? 'assunto começa com "Entrega…"' : 'assunto no padrão' });
  if (temConteudo) {
    const automatico = String(ctx.cfg.MODO_ENTREGA || '').toUpperCase().indexOf('AUTO') === 0;
    if (automatico) return Object.assign(base, { acao: 'ENTREGA', motivo: 'fora do padrão, com conteúdo (modo automático)' });
    return pendente('fora do padrão, com anexo/link', 'Assunto fora do padrão: "' + info.assunto + '".');
  }
  return ignorar('conversa (sem etiqueta, sem anexo ou link)');
}

/**
 * Equipe pelo "nome curto" citado no assunto: a parte antes do " - " do nome
 * (ex.: "Fleury", "Pipo Saúde", "Google/Fau/NIA"). Ignora nomes curtos repetidos
 * entre equipes (ex.: duas equipes "HU - …").
 */
function equipePorApelido_(assunto, equipes) {
  const simp = simplificar_(assunto);
  const apelidos = equipes.map(function (e) {
    const curto = String(e.NOME || '').split(/\s+[-–—|(]\s*/)[0];
    const palavras = simplificar_(curto).trim().split(' ').filter(function (w) { return w.length >= 3 && ['grupo', 'equipe', 'time'].indexOf(w) === -1; });
    const chaves = [simplificar_(curto).trim()].concat(palavras).filter(function (k, i, arr) { return arr.indexOf(k) === i; });
    return { e: e, chaves: chaves };
  });
  const contagem = {};
  apelidos.forEach(function (a) { a.chaves.forEach(function (k) { contagem[k] = (contagem[k] || 0) + 1; }); });
  const achadas = apelidos.filter(function (a) {
    return a.chaves.some(function (k) { return k.length >= 3 && contagem[k] === 1 && simp.indexOf(' ' + k + ' ') !== -1; });
  });
  return achadas.length === 1 ? achadas[0].e : null;
}

/* ------------------------------------------------------------------ */
/*  APOIO                                                              */
/* ------------------------------------------------------------------ */

function mapaEmails_(equipes) {
  const m = {};
  equipes.forEach(function (e) { extrairEmails_(e.EMAILS).forEach(function (x) { if (!m[x]) m[x] = e; }); });
  return m;
}

/** Links do Google Docs/Slides/Sheets/Drive no corpo do e-mail. */
function linksGoogle_(texto) {
  const achados = String(texto || '').match(/https?:\/\/(docs|drive)\.google\.com\/[^\s"'<>)]+/g) || [];
  const unicos = [];
  achados.forEach(function (l) { const k = l.replace(/[?#].*$/, ''); if (unicos.indexOf(k) === -1) unicos.push(k); });
  return unicos;
}

/** Cópia do pedido da aula (fica congelada na entrega). */
function textoPedido_(aula) {
  return 'Entregáveis:\n' + String(aula.ENTREGAVEIS || '') + '\n\nMétricas:\n' + String(aula.METRICAS || '');
}

/** Marca como "Substituída" as entregas anteriores da mesma equipe/aula ainda não enviadas. */
function substituirAnteriores_(entregas, nova) {
  entregas.forEach(function (e) {
    if (e === nova || String(e.ID) === String(nova.ID)) return;
    if (e.ID_EQUIPE !== nova.ID_EQUIPE || e.ID_AULA !== nova.ID_AULA) return;
    if ([ST.RECEBIDA].indexOf(e.STATUS) === -1 && !/aguardando|aprovad/i.test(String(e.STATUS))) return;
    if (/enviad/i.test(String(e.STATUS))) return;
    if (e.DATA_ENVIO instanceof Date && nova.DATA_ENVIO instanceof Date && e.DATA_ENVIO > nova.DATA_ENVIO) return;
    escreverCampos_(e._linha, { STATUS: ST.SUBSTITUIDA, ATUALIZADO_EM: new Date() });
    e.STATUS = ST.SUBSTITUIDA;
  });
}

/** Aplica o marcador "Consultoria/Entregas" na conversa. */
function marcarNoGmail_(idConversa) {
  try {
    const rotulo = GmailApp.getUserLabelByName(MARCADOR) || GmailApp.createLabel(MARCADOR);
    const t = GmailApp.getThreadById(String(idConversa));
    if (t) t.addLabel(rotulo);
  } catch (e) {
    console.warn('Marcador: ' + e.message);
  }
}

function linkConversa_(idConversa) {
  return idConversa ? 'https://mail.google.com/mail/u/0/#all/' + idConversa : '';
}

/** Acrescenta uma linha numa aba a partir de um objeto { CHAVE: valor }. */
function inserirLinha_(def, obj) {
  const sh = planilha_().getSheetByName(def.nome);
  sh.appendRow(def.colunas.map(function (c) { return obj[c.chave] === undefined || obj[c.chave] === null ? '' : obj[c.chave]; }));
}

/** Atualiza campos de uma linha da aba Entregas. */
function escreverCampos_(linha, campos) {
  const sh = planilha_().getSheetByName(ESQUEMA.ENTREGAS.nome);
  Object.keys(campos).forEach(function (k) {
    const i = ESQUEMA.ENTREGAS.colunas.findIndex(function (c) { return c.chave === k; });
    if (i !== -1) sh.getRange(linha, i + 1).setValue(campos[k]);
  });
}

/** Registra na aba Ações. */
function registrarAcao_(pessoa, acao, aula, equipe, detalhe) {
  try {
    inserirLinha_(ESQUEMA.ACOES, { DATA_HORA: new Date(), PESSOA: pessoa, ACAO: acao, AULA: aula || '', EQUIPE: equipe || '', DETALHE: detalhe || '' });
  } catch (e) { console.warn('Ações: ' + e.message); }
}

/** Acrescenta um parâmetro na aba Config se ainda não existir. */
function garantirParametro_(chave, valor, ajuda) {
  const sh = planilha_().getSheetByName(ESQUEMA.CONFIG.nome);
  if (!sh) return;
  const existe = sh.getLastRow() >= 2 && sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
    .some(function (l) { return String(l[0]).trim() === chave; });
  if (!existe) sh.appendRow([chave, valor, ajuda]);
}

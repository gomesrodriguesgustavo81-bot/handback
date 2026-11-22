/**
 * =====================================================================
 *  Arquivo 13_Automacao — PASSO 12
 *  1) 🤖 Modo automático (de hora em hora, sem ninguém tocar em nada):
 *     busca entregas → salva no Drive → analisa com a IA.
 *     Uma vez por dia: resumo por e-mail aos professores, lembrete às
 *     equipes na véspera do prazo e (às segundas) cópia de segurança.
 *  2) 📣 Cobrar quem não entregou (botão no app, texto revisado antes).
 *  3) 💾 Cópia de segurança da planilha (semanal + botão "agora").
 *  4) 🏁 Fechamento do curso: relatório final de cada equipe.
 * =====================================================================
 */

const VERSAO_AUTO = 'Passo 12 · 2026-11-22';
const NOME_AUTO = '🤖 Automático';
const ABA_FECHAMENTO = 'Fechamento';

var API_EXTRA = (typeof API_EXTRA !== 'undefined' && API_EXTRA) || {};
API_EXTRA.apiAutomacao = function () { return apiAutomacao.apply(null, arguments); };
API_EXTRA.apiCobranca = function () { return apiCobranca.apply(null, arguments); };
API_EXTRA.apiBackup = function () { return apiBackup.apply(null, arguments); };
API_EXTRA.apiFechamento = function () { return apiFechamento.apply(null, arguments); };

const TEXTO_LEMBRETE_PADRAO = [
  'Olá, equipe {equipe}!',
  '',
  'Lembrete: a entrega da {aula} vence amanhã, {prazo}.',
  '',
  'O que entregar:',
  '{itens}',
  '',
  'Envie para {email} com o assunto:',
  '{assunto}',
  '',
  'Bom trabalho!',
  '{professor}'
].join('\n');

const TEXTO_COBRANCA_PADRAO = [
  'Olá, equipe {equipe}!',
  '',
  'Ainda não recebemos a entrega da {aula} (prazo: {prazo}).',
  '',
  'O que entregar:',
  '{itens}',
  '',
  'Se vocês já enviaram, confiram se foi para {email} com o assunto exatamente assim:',
  '{assunto}',
  '',
  'Qualquer dificuldade, é só responder este e-mail.',
  '{professor}'
].join('\n');

/** Parâmetros (criados na aba Config na primeira vez). */
const PARAM_AUTO = [
  ['AUTO_BUSCAR', 'SIM', 'Modo automático: buscar entregas no Gmail de hora em hora.'],
  ['AUTO_ANALISAR', 'SIM', 'Modo automático: analisar com a IA as entregas recebidas (nada é enviado sem aprovação).'],
  ['AUTO_RESUMO_PROFESSORES', 'SIM', 'Uma vez por dia: e-mail aos professores quando há devolutivas esperando aprovação.'],
  ['AUTO_LEMBRETE_PRAZO', 'SIM', 'Na véspera do prazo: lembrete por e-mail às equipes que ainda não entregaram.'],
  ['AUTO_BACKUP', 'SIM', 'Toda segunda-feira: cópia de segurança da planilha no Drive.'],
  ['AUTO_HORA_DIARIA', '18', 'Hora das tarefas diárias (resumo, lembretes, cópia), de 0 a 23.'],
  ['BACKUPS_MANTER', '8', 'Quantas cópias de segurança guardar (as mais antigas vão para a lixeira).'],
  ['TEXTO_LEMBRETE', TEXTO_LEMBRETE_PADRAO, 'Lembrete da véspera. Use {equipe} {aula} {prazo} {itens} {email} {assunto} {professor}.'],
  ['TEXTO_COBRANCA', TEXTO_COBRANCA_PADRAO, 'Cobrança de quem não entregou. Mesmos campos do lembrete.']
];

/* ------------------------------------------------------------------ */
/*  AUTORIZAÇÃO (rodar uma vez no editor)                              */
/* ------------------------------------------------------------------ */

/**
 * ▶️ RODE ESTA FUNÇÃO UMA VEZ NO EDITOR (botão Executar) para o Google
 * pedir as permissões do modo automático (agendar tarefas).
 */
function autorizarAutomacao() {
  ScriptApp.getProjectTriggers();
  DriveApp.getRootFolder().getName();
  configAuto_();
  Logger.log('✅ Modo automático autorizado. Agora volte ao app › ⚙️ Ajustes › 🤖 Modo automático.');
}

/* ------------------------------------------------------------------ */
/*  1) MODO AUTOMÁTICO                                                 */
/* ------------------------------------------------------------------ */

/** acao: 'estado' | 'ligar' | 'desligar' | 'salvar' (valores) | 'rodar' (agora) */
function apiAutomacao(acao, valores) {
  return api_(function () {
    if (!ACESSO || !ACESSO.dono) throw new Error('Só o assistente mexe no modo automático.');
    if (acao === 'ligar') {
      removerGatilhos_();
      ScriptApp.newTrigger('rotinaAutomatica').timeBased().everyHours(1).create();
      registrarAcao_(quem_(), 'Modo automático ligado', '', '', 'de hora em hora');
    } else if (acao === 'desligar') {
      removerGatilhos_();
      registrarAcao_(quem_(), 'Modo automático desligado', '', '', '');
    } else if (acao === 'salvar') {
      configAuto_();
      const v = valores || {};
      const hora = String(v.AUTO_HORA_DIARIA === undefined ? '18' : v.AUTO_HORA_DIARIA).trim();
      if (!/^\d{1,2}$/.test(hora) || +hora > 23) throw new Error('Hora das tarefas diárias: use um número de 0 a 23.');
      const manter = String(v.BACKUPS_MANTER === undefined ? '8' : v.BACKUPS_MANTER).trim();
      if (!/^\d{1,2}$/.test(manter) || +manter < 1) throw new Error('Cópias a guardar: use um número de 1 a 99.');
      const novos = {};
      ['AUTO_BUSCAR', 'AUTO_ANALISAR', 'AUTO_RESUMO_PROFESSORES', 'AUTO_LEMBRETE_PRAZO', 'AUTO_BACKUP'].forEach(function (k) {
        if (v[k] !== undefined) novos[k] = /^n/i.test(String(v[k])) ? 'NÃO' : 'SIM';
      });
      novos.AUTO_HORA_DIARIA = hora;
      novos.BACKUPS_MANTER = manter;
      ['TEXTO_LEMBRETE', 'TEXTO_COBRANCA'].forEach(function (k) {
        if (v[k] !== undefined) novos[k] = String(v[k]).trim() || (k === 'TEXTO_LEMBRETE' ? TEXTO_LEMBRETE_PADRAO : TEXTO_COBRANCA_PADRAO);
      });
      escreverConfigAuto_(novos);
      registrarAcao_(quem_(), 'Ajustes do modo automático salvos', '', '', '');
    } else if (acao === 'rodar') {
      return rotinaAutomatica_(true);
    }
    const cfg = configAuto_();
    const ult = lerJsonProp_('AUTO_ULTIMA');
    return {
      ligado: gatilhos_().length > 0,
      ultima: ult.em || '', resumo: ult.resumo || '',
      config: PARAM_AUTO.reduce(function (o, p) { o[p[0]] = cfg[p[0]]; return o; }, {})
    };
  });
}

/** Chamada pelo Google de hora em hora (gatilho). */
function rotinaAutomatica() {
  rotinaAutomatica_(false);
}

/**
 * Faz o trabalho do modo automático. Em "forcarDiarias" (botão "Rodar agora")
 * as tarefas diárias também rodam, mas ainda só uma vez por dia.
 */
function rotinaAutomatica_(forcarDiarias) {
  const inicio = Date.now();
  if (!ACESSO) ACESSO = { nome: NOME_AUTO, dono: true };
  const cfg = configAuto_();
  const tz = planilha_().getSpreadsheetTimeZone();
  const feito = [];
  const erros = [];
  const etapa = function (nome, fn) {
    try { const r = fn(); if (r) feito.push(r); } catch (e) { erros.push(nome + ': ' + String(e.message || e).split('\n')[0]); }
  };

  if (sim_(cfg.AUTO_BUSCAR)) {
    etapa('Busca', function () {
      const r = buscarEntregas_(NOME_AUTO);
      return (r.novas || r.possiveis) ? '📥 ' + r.novas + ' nova(s)' + (r.possiveis ? ', ' + r.possiveis + ' para confirmar' : '') : '';
    });
    if (typeof sincronizarDrive_ === 'function') {
      etapa('Drive', function () {
        const lock = LockService.getScriptLock();
        if (!lock.tryLock(5000)) return '';
        try { const r = sincronizarDrive_(); return r.arquivos ? '📁 ' + r.arquivos + ' arquivo(s) no Drive' : ''; } finally { lock.releaseLock(); }
      });
    }
  }

  if (sim_(cfg.AUTO_ANALISAR)) {
    etapa('Análise', function () {
      const ctx = contextoAnalise_();
      const fila = ctx.entregas.filter(function (e) { return e.STATUS === ST.RECEBIDA; })
        .sort(function (a, b) { return (a.DATA_ENVIO || 0) - (b.DATA_ENVIO || 0); });
      let n = 0;
      const falhas = [];
      for (let i = 0; i < fila.length; i++) {
        if (Date.now() - inicio > 3.5 * 60 * 1000) break; // o resto fica para a próxima hora
        try {
          analisarUma_(fila[i], ctx);
          n++;
          registrarAcao_(NOME_AUTO, 'Entrega analisada pela IA', fila[i].AULA, fila[i].EQUIPE, fila[i].CONCEITO);
        } catch (err) {
          falhas.push(fila[i].EQUIPE + ': ' + String(err.message || err).split('\n')[0]);
        }
      }
      if (falhas.length) erros.push('Análise: ' + falhas.join(' | '));
      return n ? '🤖 ' + n + ' analisada(s)' : '';
    });
  }

  // Tarefas diárias: uma vez por dia, a partir da hora escolhida
  const agora = new Date();
  const hoje = Utilities.formatDate(agora, tz, 'yyyy-MM-dd');
  const hora = Number(Utilities.formatDate(agora, tz, 'H'));
  const props = PropertiesService.getScriptProperties();
  const horaDiaria = parseInt(cfg.AUTO_HORA_DIARIA, 10);
  if (props.getProperty('AUTO_ULTIMO_DIA') !== hoje && (forcarDiarias || hora >= (isNaN(horaDiaria) ? 18 : horaDiaria))) {
    props.setProperty('AUTO_ULTIMO_DIA', hoje);
    if (sim_(cfg.AUTO_LEMBRETE_PRAZO)) etapa('Lembretes', function () { const n = enviarLembretesVespera_(cfg); return n ? '⏰ ' + n + ' lembrete(s) de prazo' : ''; });
    if (sim_(cfg.AUTO_RESUMO_PROFESSORES)) etapa('Resumo', function () { const n = enviarResumoDiario_(); return n ? '📬 resumo para ' + n + ' pessoa(s)' : ''; });
    if (sim_(cfg.AUTO_BACKUP) && Utilities.formatDate(agora, tz, 'u') === '1') etapa('Cópia', function () { fazerBackup_(cfg); return '💾 cópia de segurança'; });
  }

  const resumo = (feito.length ? feito.join(' · ') : 'Nada novo') + (erros.length ? '\n⚠️ ' + erros.join('\n⚠️ ') : '');
  props.setProperty('AUTO_ULTIMA', JSON.stringify({ em: Utilities.formatDate(agora, tz, 'dd/MM HH:mm'), resumo: resumo }));
  if (feito.length || erros.length) registrarAcao_(NOME_AUTO, 'Rotina automática', '', '', resumo);
  return { resumo: resumo, ligado: gatilhos_().length > 0 };
}

/** E-mail diário: o que espera por cada um (professores aprovam; assistente envia). */
function enviarResumoDiario_() {
  const ents = lerAba_(ESQUEMA.ENTREGAS);
  const contar = function (re) { return ents.filter(function (e) { return re.test(String(e.STATUS)); }).length; };
  const aguardando = contar(/^aguardando aprova/i);
  const aprovadas = contar(/^aprovad/i);
  const confirmar = contar(/poss[ií]vel/i);
  const semAnalise = contar(/^recebida$/i);
  let enviados = 0;
  const botao = function (link, txt) {
    return '<p><a href="' + link + '" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">' + txt + '</a></p>';
  };
  const caixa = function (linhas) {
    return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.6">' + linhas.join('') + '</div>';
  };

  if (aguardando) {
    const planos = lerLinksPlanos_();
    lerLinks_().filter(function (p) { return p.email; }).forEach(function (p) {
      const link = planos[p.hash] || ScriptApp.getService().getUrl();
      MailApp.sendEmail({
        to: p.email,
        subject: '📝 ' + aguardando + ' devolutiva(s) esperando sua aprovação',
        htmlBody: caixa(['<p>Olá, ' + escaparTexto_(p.nome) + '!</p>',
          '<p>Há <b>' + aguardando + '</b> devolutiva(s) analisada(s) esperando revisão e aprovação no app.</p>', botao(link, 'Revisar e aprovar'),
          '<p style="color:#64748b;font-size:12px">Resumo automático diário da consultoria.</p>']),
        body: 'Há ' + aguardando + ' devolutiva(s) esperando aprovação: ' + link
      });
      enviados++;
    });
  }
  if (aprovadas || confirmar || semAnalise) {
    const eu = Session.getEffectiveUser().getEmail();
    const itens = [aprovadas ? '<li><b>' + aprovadas + '</b> aprovada(s) esperando você enviar</li>' : '',
      confirmar ? '<li><b>' + confirmar + '</b> e-mail(s) "Para confirmar"</li>' : '',
      semAnalise ? '<li><b>' + semAnalise + '</b> entrega(s) ainda sem análise</li>' : '',
      aguardando ? '<li><b>' + aguardando + '</b> esperando a aprovação dos professores</li>' : ''].join('');
    MailApp.sendEmail({
      to: eu, subject: '📋 Consultoria: o que está esperando por você',
      htmlBody: caixa(['<p>Resumo do dia:</p><ul>' + itens + '</ul>', botao(ScriptApp.getService().getUrl(), 'Abrir o app')]),
      body: 'Aprovadas para enviar: ' + aprovadas + ' · Para confirmar: ' + confirmar + ' · Sem análise: ' + semAnalise + ' · Esperando professores: ' + aguardando
    });
    enviados++;
  }
  return enviados;
}

/* ------------------------------------------------------------------ */
/*  2) LEMBRETE NA VÉSPERA E COBRANÇA                                  */
/* ------------------------------------------------------------------ */

/** Equipes que ainda não têm entrega válida na aula. */
function equipesSemEntrega_(idAula) {
  const ents = lerAba_(ESQUEMA.ENTREGAS).filter(function (e) {
    return String(e.ID_AULA) === String(idAula) && !/substitu|ignorad|poss[ií]vel/i.test(String(e.STATUS));
  });
  const com = {};
  ents.forEach(function (e) { com[String(e.ID_EQUIPE)] = true; });
  return lerAba_(ESQUEMA.EQUIPES).filter(function (q) { return !com[String(q.ID_EQUIPE)]; });
}

/** Troca {equipe} {aula} {prazo} {itens} {email} {assunto} {professor}. */
function preencherTexto_(modelo, aula, equipe, cfg) {
  const tz = planilha_().getSpreadsheetTimeZone();
  const hp = String(cfg.AGENDA_HORA_PRAZO || '').match(/^(\d{1,2}):(\d{2})/);
  const horaPrazo = hp ? hp[1] + ':' + hp[2] : '23:59';
  const prazo = aula.RECEBE_ATE instanceof Date ? Utilities.formatDate(aula.RECEBE_ATE, tz, 'dd/MM') + ' até ' + horaPrazo : 'a combinar';
  const valores = {
    equipe: String(equipe.NOME || ''),
    aula: 'Aula ' + aula.NUMERO + (aula.TITULO ? ' — ' + aula.TITULO : ''),
    prazo: prazo,
    itens: itensDoPedido_(aula.ENTREGAVEIS).map(function (x) { return '• ' + x; }).join('\n') || '(veja as instruções da aula)',
    email: extrairEmails_(cfg.EMAIL_ENTREGAS)[0] || Session.getEffectiveUser().getEmail(),
    assunto: assuntoPadrao_(cfg.ASSUNTO_PREFIXO, aula.NUMERO, equipe.NOME),
    professor: String(cfg.NOME_PROFESSOR || '')
  };
  return String(modelo || '').replace(/\{(equipe|aula|prazo|itens|email|assunto|professor)\}/g, function (m, k) { return valores[k]; }).trim();
}

function enviarParaEquipe_(equipe, assunto, texto, cfg) {
  const para = extrairEmails_(equipe.EMAILS);
  if (!para.length) throw new Error(equipe.NOME + ' não tem e-mails cadastrados.');
  const html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.6">' +
    escaparTexto_(texto).replace(/\n/g, '<br>') + '</div>';
  const op = { htmlBody: html };
  if (cfg.NOME_PROFESSOR) op.name = String(cfg.NOME_PROFESSOR);
  GmailApp.sendEmail(para.join(','), assunto, texto, op);
}

/** Véspera do prazo: lembra só quem ainda não entregou (uma vez por aula e equipe). */
function enviarLembretesVespera_(cfg) {
  const tz = planilha_().getSpreadsheetTimeZone();
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
  const dia = Utilities.formatDate(amanha, tz, 'yyyy-MM-dd');
  const feitos = lerJsonProp_('LEMBRETES_ENVIADOS');
  let n = 0;
  lerAba_(ESQUEMA.AULAS).forEach(function (a) {
    if (!(a.RECEBE_ATE instanceof Date) || Utilities.formatDate(a.RECEBE_ATE, tz, 'yyyy-MM-dd') !== dia) return;
    equipesSemEntrega_(a.ID_AULA).forEach(function (q) {
      const k = a.ID_AULA + '|' + q.ID_EQUIPE;
      if (feitos[k] || !extrairEmails_(q.EMAILS).length) return;
      enviarParaEquipe_(q, '⏰ Lembrete: entrega da Aula ' + a.NUMERO + ' vence amanhã', preencherTexto_(cfg.TEXTO_LEMBRETE, a, q, cfg), cfg);
      feitos[k] = dia;
      n++;
      registrarAcao_(NOME_AUTO, 'Lembrete de prazo enviado', 'Aula ' + a.NUMERO, q.NOME, '');
    });
  });
  PropertiesService.getScriptProperties().setProperty('LEMBRETES_ENVIADOS', JSON.stringify(feitos));
  return n;
}

/**
 * 📣 Cobrar quem não entregou.
 *   'previa' → equipes sem entrega + assunto e texto (editáveis)
 *   'enviar' → { ids:[...], assunto, texto } um e-mail por equipe
 */
function apiCobranca(acao, idAula, dados) {
  return api_(function () {
    if (!ACESSO || !ACESSO.dono) throw new Error('Só o assistente envia a cobrança (sai da conta dele).');
    const cfg = configAuto_();
    const aula = lerAba_(ESQUEMA.AULAS).filter(function (a) { return String(a.ID_AULA) === String(idAula); })[0];
    if (!aula) throw new Error('Aula não encontrada.');
    const faltam = equipesSemEntrega_(idAula);
    const cobrados = lerJsonProp_('COBRANCAS_ENVIADAS');
    if (acao === 'previa') {
      return {
        aula: 'Aula ' + aula.NUMERO + ' — ' + aula.TITULO,
        assunto: 'Entrega pendente: Aula ' + aula.NUMERO + (aula.TITULO ? ' — ' + aula.TITULO : ''),
        texto: String(cfg.TEXTO_COBRANCA || TEXTO_COBRANCA_PADRAO),
        exemplo: faltam.length ? preencherTexto_(cfg.TEXTO_COBRANCA, aula, faltam[0], cfg) : '',
        equipes: faltam.map(function (q) {
          return { id: String(q.ID_EQUIPE), nome: String(q.NOME), emails: extrairEmails_(q.EMAILS).length, cobradaEm: cobrados[aula.ID_AULA + '|' + q.ID_EQUIPE] || '' };
        })
      };
    }
    const d = dados || {};
    const ids = (d.ids || []).map(String);
    if (!ids.length) throw new Error('Escolha pelo menos uma equipe.');
    const assunto = String(d.assunto || '').trim();
    if (!assunto) throw new Error('Escreva o assunto.');
    const tz = planilha_().getSpreadsheetTimeZone();
    const enviados = [], falhas = [];
    faltam.filter(function (q) { return ids.indexOf(String(q.ID_EQUIPE)) !== -1; }).forEach(function (q) {
      try {
        enviarParaEquipe_(q, assunto, preencherTexto_(d.texto || cfg.TEXTO_COBRANCA, aula, q, cfg), cfg);
        cobrados[aula.ID_AULA + '|' + q.ID_EQUIPE] = Utilities.formatDate(new Date(), tz, 'dd/MM HH:mm');
        enviados.push(String(q.NOME));
        registrarAcao_(quem_(), 'Cobrança enviada', 'Aula ' + aula.NUMERO, q.NOME, assunto);
      } catch (e) { falhas.push(q.NOME + ': ' + e.message); }
    });
    PropertiesService.getScriptProperties().setProperty('COBRANCAS_ENVIADAS', JSON.stringify(cobrados));
    if (d.salvarTexto && d.texto) escreverConfigAuto_({ TEXTO_COBRANCA: String(d.texto).trim() });
    return { enviados: enviados, falhas: falhas };
  });
}

/* ------------------------------------------------------------------ */
/*  3) CÓPIA DE SEGURANÇA                                              */
/* ------------------------------------------------------------------ */

/** acao: 'listar' | 'agora' */
function apiBackup(acao) {
  return api_(function () {
    if (!ACESSO || !ACESSO.dono) throw new Error('Só o assistente faz cópias de segurança.');
    const cfg = configAuto_();
    let nova = null;
    if (acao === 'agora') {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) throw new Error('Outra operação está em andamento. Tente de novo em instantes.');
      try { nova = fazerBackup_(cfg); } finally { lock.releaseLock(); }
    }
    const pasta = pastaBackups_();
    const tz = planilha_().getSpreadsheetTimeZone();
    return {
      nova: nova,
      pasta: pasta.getUrl(),
      copias: arquivosBackup_(pasta).slice(0, 10).map(function (f) {
        return { nome: f.getName(), url: f.getUrl(), em: Utilities.formatDate(f.getDateCreated(), tz, 'dd/MM/yyyy HH:mm') };
      })
    };
  });
}

function fazerBackup_(cfg) {
  const ss = planilha_();
  const tz = ss.getSpreadsheetTimeZone();
  const pasta = pastaBackups_();
  const nome = 'Backup — ' + ss.getName() + ' — ' + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH\'h\'mm');
  const copia = DriveApp.getFileById(ss.getId()).makeCopy(nome, pasta);
  const manter = Math.max(parseInt(cfg.BACKUPS_MANTER, 10) || 8, 1);
  arquivosBackup_(pasta).slice(manter).forEach(function (f) { try { f.setTrashed(true); } catch (e) { /* sem permissão: deixa */ } });
  registrarAcao_(quem_(), 'Cópia de segurança', '', '', nome);
  return { nome: nome, url: copia.getUrl() };
}

/** Pasta "Cópias de segurança" (dentro da pasta das entregas, se existir). */
function pastaBackups_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('PASTA_BACKUPS');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* apagada: cria outra */ } }
  let pai = null;
  if (typeof pastaRaiz_ === 'function') { try { pai = pastaRaiz_(); } catch (e) { pai = null; } }
  const nome = 'Cópias de segurança';
  const p = pai ? pai.createFolder(nome) : DriveApp.createFolder(nome + ' — Consultoria');
  props.setProperty('PASTA_BACKUPS', p.getId());
  return p;
}

function arquivosBackup_(pasta) {
  const lista = [];
  const it = pasta.getFiles();
  while (it.hasNext()) { const f = it.next(); if (/^Backup — /.test(f.getName())) lista.push(f); }
  return lista.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
}

/* ------------------------------------------------------------------ */
/*  4) FECHAMENTO DO CURSO                                             */
/* ------------------------------------------------------------------ */

const COLUNAS_FECHAMENTO = ['ID Equipe', 'Equipe', 'Gerado em', 'Conceito geral', 'Linha do tempo', 'Resumo', 'Evolução',
  'Pontos fortes', 'A desenvolver', 'Recomendação final', 'Modelo de IA'];

/** acao: 'ver' | 'gerar' | 'enviar' (aos professores) */
function apiFechamento(idEquipe, acao) {
  return api_(function () {
    const q = lerAba_(ESQUEMA.EQUIPES).filter(function (x) { return String(x.ID_EQUIPE) === String(idEquipe); })[0];
    if (!q) throw new Error('Equipe não encontrada.');
    const linha = linhaDoTempo_(q);
    if (acao === 'gerar') {
      if (!linha.some(function (l) { return l.conceito; })) throw new Error('A equipe ainda não tem entregas analisadas.');
      const r = chamarGemini_(instrucaoFechamento_(), [{ text: textoFechamento_(q, linha) }], esquemaFechamento_(), false);
      const res = r.resultado || {};
      const lista = function (arr) { return (Array.isArray(arr) ? arr : [arr]).filter(Boolean).map(function (x) { return '• ' + String(x).trim(); }).join('\n'); };
      salvarFechamento_([String(q.ID_EQUIPE), String(q.NOME), new Date(),
        CONCEITOS.indexOf(String(res.conceito_geral)) !== -1 ? String(res.conceito_geral) : '',
        linha.map(function (l) { return l.aula + ': ' + (l.conceito || l.situacao); }).join('\n'),
        String(res.resumo || '').trim(), String(res.evolucao || '').trim(), lista(res.pontos_fortes), lista(res.a_desenvolver),
        String(res.recomendacao_final || '').trim(), r.modelo]);
      registrarAcao_(quem_(), 'Fechamento do curso gerado', '', q.NOME, '');
    }
    const f = lerFechamento_(idEquipe);
    if (acao === 'enviar') {
      if (!f) throw new Error('Gere o fechamento antes de enviar.');
      enviarFechamento_(q, f, linha);
    }
    const publica = linha.map(function (l) { return { aula: l.aula, conceito: l.conceito, situacao: l.situacao, atraso: l.atraso, checklist: l.checklist }; });
    return { equipe: String(q.NOME), linha: publica, fechamento: f };
  });
}

/** Última entrega válida da equipe em cada aula, em ordem. */
function linhaDoTempo_(q) {
  const ents = lerAba_(ESQUEMA.ENTREGAS).filter(function (e) {
    return String(e.ID_EQUIPE) === String(q.ID_EQUIPE) && !/substitu|ignorad|poss[ií]vel/i.test(String(e.STATUS));
  });
  return lerAba_(ESQUEMA.AULAS).sort(function (a, b) { return Number(a.NUMERO) - Number(b.NUMERO); }).map(function (a) {
    const e = ents.filter(function (x) { return String(x.ID_AULA) === String(a.ID_AULA); })
      .sort(function (x, y) { return (x.DATA_ENVIO || 0) - (y.DATA_ENVIO || 0); }).pop();
    const ck = e ? lerChecklist_(e.CHECKLIST) : [];
    return {
      aula: 'Aula ' + a.NUMERO + ' — ' + a.TITULO,
      conceito: e && CONCEITOS.indexOf(String(e.CONCEITO)) !== -1 ? String(e.CONCEITO) : '',
      situacao: !e ? 'não entregou' : (String(e.CONCEITO) ? String(e.STATUS) : 'sem análise'),
      atraso: !!(e && String(e.ATRASO).toUpperCase() === 'SIM'),
      checklist: ck.length ? ck.filter(function (c) { return c.status === 'ENTREGUE'; }).length + '/' + ck.length + ' itens completos' : '',
      _justificativa: e ? String(e.JUSTIFICATIVA || '') : '',
      _analise: e ? String(e.ANALISE_PROFESSOR || '') : '',
      _feedback: e ? String(e.FEEDBACK_EQUIPE || '') : ''
    };
  }).filter(function (l, i, arr) {
    // Esconde aulas futuras sem entrega no fim da lista
    return l.conceito || l.situacao !== 'não entregou' || arr.slice(i + 1).some(function (x) { return x.situacao !== 'não entregou'; });
  });
}

function instrucaoFechamento_() {
  return [
    'Você apoia os professores de uma consultoria acadêmica com equipes multidisciplinares (design, saúde e tecnologia).',
    'Escreva o FECHAMENTO DO CURSO de UMA equipe, para os professores, com base SOMENTE nos dados fornecidos.',
    'Regras: nunca use notas, pontuações ou porcentagens; use apenas os conceitos EXCELENTE, BOM, REGULAR, RUIM;',
    'não invente fatos; cite aulas concretas; tom profissional e construtivo; português do Brasil.',
    'Campos:',
    '• conceito_geral: o conceito que melhor representa a jornada (pese mais as aulas finais e a evolução).',
    '• resumo: 3 a 5 frases sobre a jornada da equipe.',
    '• evolucao: 2 a 4 frases sobre como a equipe evoluiu (ou não) ao longo das aulas, citando-as.',
    '• pontos_fortes: 2 a 4 itens.',
    '• a_desenvolver: 2 a 4 itens.',
    '• recomendacao_final: 1 a 3 frases (próximos passos para a equipe ou para o projeto).'
  ].join('\n');
}

function esquemaFechamento_() {
  return {
    type: 'OBJECT',
    properties: {
      conceito_geral: { type: 'STRING', enum: ['EXCELENTE', 'BOM', 'REGULAR', 'RUIM'] },
      resumo: { type: 'STRING' },
      evolucao: { type: 'STRING' },
      pontos_fortes: { type: 'ARRAY', items: { type: 'STRING' } },
      a_desenvolver: { type: 'ARRAY', items: { type: 'STRING' } },
      recomendacao_final: { type: 'STRING' }
    },
    required: ['conceito_geral', 'resumo', 'evolucao', 'pontos_fortes', 'a_desenvolver', 'recomendacao_final']
  };
}

function textoFechamento_(q, linha) {
  const l = ['EQUIPE: ' + q.NOME + (q.TEMA ? ' (tema: ' + q.TEMA + ')' : ''), '', 'JORNADA AULA A AULA:'];
  linha.forEach(function (x) {
    l.push('--- ' + x.aula + ': ' + (x.conceito || x.situacao) + (x.atraso ? ' (com atraso)' : '') + (x.checklist ? ' · ' + x.checklist : ''));
    if (x._justificativa) l.push('Justificativa: ' + x._justificativa.slice(0, 500));
    if (x._analise) l.push('Análise interna: ' + x._analise.slice(0, 900));
    if (x._feedback) l.push('Devolutiva à equipe: ' + x._feedback.slice(0, 600));
  });
  return l.join('\n');
}

function abaFechamento_() {
  const ss = planilha_();
  let sh = ss.getSheetByName(ABA_FECHAMENTO);
  if (!sh) {
    sh = ss.insertSheet(ABA_FECHAMENTO);
    sh.getRange(1, 1, 1, COLUNAS_FECHAMENTO.length).setValues([COLUNAS_FECHAMENTO]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function salvarFechamento_(valores) {
  const sh = abaFechamento_();
  const n = sh.getLastRow();
  const ids = n >= 2 ? sh.getRange(2, 1, n - 1, 1).getValues().map(function (l) { return String(l[0]); }) : [];
  const i = ids.indexOf(String(valores[0]));
  if (i === -1) sh.appendRow(valores);
  else sh.getRange(i + 2, 1, 1, valores.length).setValues([valores]);
}

function lerFechamento_(idEquipe) {
  const sh = planilha_().getSheetByName(ABA_FECHAMENTO);
  if (!sh || sh.getLastRow() < 2) return null;
  const l = sh.getRange(2, 1, sh.getLastRow() - 1, COLUNAS_FECHAMENTO.length).getValues()
    .filter(function (x) { return String(x[0]) === String(idEquipe); })[0];
  if (!l) return null;
  return { geradoEm: fmtData_(l[2], 'dd/MM/yyyy HH:mm'), conceito: String(l[3] || ''), resumo: String(l[5] || ''), evolucao: String(l[6] || ''),
    pontosFortes: String(l[7] || ''), aDesenvolver: String(l[8] || ''), recomendacao: String(l[9] || ''), modelo: String(l[10] || '') };
}

function enviarFechamento_(q, f, linha) {
  const para = extrairEmails_(lerConfig_().EMAIL_PROFESSOR);
  if (!para.length) throw new Error('Cadastre os professores (com e-mail) em Ajustes › Professores.');
  const esc = escaparTexto_;
  const bloco = function (t, txt) {
    return txt ? '<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:18px 0 6px">' + t + '</h3>' +
      '<div style="font-size:14px;line-height:1.6">' + esc(txt).replace(/\n/g, '<br>') + '</div>' : '';
  };
  const jornada = linha.map(function (l) { return l.aula + ': ' + (l.conceito || l.situacao) + (l.atraso ? ' (atraso)' : ''); }).join('\n');
  MailApp.sendEmail({
    to: para.join(','),
    subject: '🏁 Fechamento do curso — ' + q.NOME,
    htmlBody: '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;color:#0f172a">' +
      '<h2 style="margin:0 0 4px">🏁 Fechamento do curso — ' + esc(q.NOME) + '</h2>' +
      (f.conceito ? '<p style="margin:0 0 8px">Conceito geral: <b>' + esc(f.conceito) + '</b></p>' : '') +
      bloco('Jornada', jornada) + bloco('Resumo', f.resumo) + bloco('Evolução', f.evolucao) + bloco('Pontos fortes', f.pontosFortes) +
      bloco('A desenvolver', f.aDesenvolver) + bloco('Recomendação final', f.recomendacao) + '</div>',
    body: 'Fechamento do curso — ' + q.NOME + '\n\n' + jornada + '\n\n' + f.resumo
  });
  registrarAcao_(quem_(), 'Fechamento enviado aos professores', '', q.NOME, para.join(', '));
}

/* ------------------------------------------------------------------ */
/*  APOIO                                                              */
/* ------------------------------------------------------------------ */

function gatilhos_() {
  return ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'rotinaAutomatica'; });
}

function removerGatilhos_() {
  gatilhos_().forEach(function (t) { ScriptApp.deleteTrigger(t); });
}

/** Config com os parâmetros do modo automático (cria os que faltarem). */
function configAuto_() {
  PARAM_AUTO.forEach(function (p) { garantirParametro_(p[0], p[1], p[2]); });
  const cfg = lerConfig_();
  const sh = planilha_().getSheetByName(ESQUEMA.CONFIG.nome);
  sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).getDisplayValues().forEach(function (l) {
    const k = String(l[0]).trim();
    if (/^(AUTO_|BACKUPS_|TEXTO_|AGENDA_HORA_PRAZO)/.test(k)) cfg[k] = String(l[1] || '').trim();
  });
  PARAM_AUTO.forEach(function (p) { if (!cfg[p[0]]) cfg[p[0]] = p[1]; });
  return cfg;
}

function escreverConfigAuto_(valores) {
  const sh = planilha_().getSheetByName(ESQUEMA.CONFIG.nome);
  const chaves = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (l) { return String(l[0]).trim(); });
  Object.keys(valores).forEach(function (k) {
    const i = chaves.indexOf(k);
    if (i !== -1) sh.getRange(i + 2, 2).setNumberFormat('@').setValue(valores[k]);
  });
}

function lerJsonProp_(chave) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(chave) || '{}'); } catch (e) { return {}; }
}

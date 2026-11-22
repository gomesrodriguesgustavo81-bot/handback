/**
 * =====================================================================
 *  Arquivo 12_Calendario — PASSO 11.2
 *  Agenda da consultoria no Google Agenda (na SUA conta):
 *    • 📚 Aula N — dia da aula            → professores + equipes
 *    • ⏰ Prazo de entrega — Aula N        → professores + equipes
 *    • 📝 Devolutivas — Aula N (interno)  → só professores
 *  Os convidados recebem o convite e veem tudo no próprio celular.
 *  Os alunos NÃO veem os e-mails uns dos outros.
 *  Mudou a data de uma aula no app? A agenda se ajusta sozinha.
 * =====================================================================
 */

const VERSAO_AGENDA = 'Passo 11.2 · 2026-11-19';
const NOME_AGENDA = 'Consultoria — Aulas e Entregas';

var API_EXTRA = (typeof API_EXTRA !== 'undefined' && API_EXTRA) || {};
API_EXTRA.apiAgenda = function () { return apiAgenda.apply(null, arguments); };
API_EXTRA.apiSincronizarAgenda = function () { return apiSincronizarAgenda.apply(null, arguments); };
API_EXTRA.apiConfigAgenda = function () { return apiConfigAgenda.apply(null, arguments); };
API_EXTRA.apiAgendaData = function () { return apiAgendaData.apply(null, arguments); };
API_EXTRA.apiAgendaExtra = function () { return apiAgendaExtra.apply(null, arguments); };

/** Parâmetros da agenda (criados na aba Config na primeira vez). */
const PARAM_AGENDA = [
  ['AGENDA_HORARIO_AULA', '', 'Horário das aulas no Google Agenda (ex.: 19:00-22:00). Vazio = evento de dia inteiro.'],
  ['AGENDA_HORA_PRAZO', '23:59', 'Hora-limite das entregas no dia "Recebe entregas até" (ex.: 23:59).'],
  ['AGENDA_DIAS_DEVOLUTIVA', '3', 'Quantos dias depois do prazo de entrega as devolutivas devem sair (lembrete interno).'],
  ['AGENDA_CONVIDAR_EQUIPES', 'SIM', 'SIM = os alunos recebem o convite das aulas e prazos. NÃO = só os professores.']
];

/**
 * ▶️ RODE ESTA FUNÇÃO UMA VEZ NO EDITOR (botão Executar) para o Google
 * pedir a permissão do Agenda. Sem isso aparece "does not have permission".
 */
function autorizarAgenda() {
  CalendarApp.getDefaultCalendar().getName();
  const est = lerMapaAgenda_('AGENDA_ESTADO');
  Logger.log('✅ Agenda autorizada. Agora volte ao app › 📅 Agenda.' + (est.id ? ' (agenda já criada)' : ''));
}

/* ------------------------------------------------------------------ */
/*  APIs                                                               */
/* ------------------------------------------------------------------ */

/** Dados da aba Agenda do app (datas + prazo das devolutivas + estado da agenda). */
function apiAgenda() {
  return api_(function () {
    const cfg = configAgenda_();
    const tz = planilha_().getSpreadsheetTimeZone();
    const iso = function (d) { return d instanceof Date ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : ''; };
    const est = lerMapaAgenda_('AGENDA_ESTADO');
    return {
      dono: !!(ACESSO && ACESSO.dono),
      criada: !!est.id,
      url: est.id ? 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(est.id) : '',
      sincronizadaEm: est.em || '',
      config: {
        horario: cfg.AGENDA_HORARIO_AULA, horaPrazo: cfg.AGENDA_HORA_PRAZO,
        diasDevolutiva: cfg.AGENDA_DIAS_DEVOLUTIVA, convidarEquipes: cfg.AGENDA_CONVIDAR_EQUIPES
      },
      extras: lerExtras_(),
      aulas: lerAba_(ESQUEMA.AULAS).sort(function (a, b) { return Number(a.NUMERO) - Number(b.NUMERO); }).map(function (a) {
        const dev = prazoDevolutiva_(a, cfg);
        return { id: String(a.ID_AULA), numero: a.NUMERO, titulo: String(a.TITULO || ''),
          dataAula: iso(a.DATA_AULA), recebeDe: iso(a.RECEBE_DE), recebeAte: iso(a.RECEBE_ATE), devolutivaAte: iso(dev) };
      })
    };
  });
}

/** Salva os ajustes da agenda (só o assistente) e já atualiza o Google Agenda. */
function apiConfigAgenda(v) {
  return api_(function () {
    if (!ACESSO || !ACESSO.dono) throw new Error('Só o assistente muda os ajustes da agenda.');
    v = v || {};
    const horario = String(v.horario || '').trim();
    if (horario && !lerHorario_(horario)) throw new Error('Horário inválido. Use o formato 19:00-22:00 (ou deixe vazio).');
    const horaPrazo = String(v.horaPrazo || '23:59').trim();
    if (!/^\d{1,2}[:h]\d{2}$/.test(horaPrazo)) throw new Error('Hora do prazo inválida. Use o formato 23:59.');
    const dias = String(v.diasDevolutiva === undefined ? '3' : v.diasDevolutiva).trim();
    if (!/^\d{1,2}$/.test(dias)) throw new Error('Dias para a devolutiva: use um número (ex.: 3).');
    configAgenda_();
    escreverConfigAgenda_({ AGENDA_HORARIO_AULA: horario, AGENDA_HORA_PRAZO: horaPrazo.replace('h', ':'),
      AGENDA_DIAS_DEVOLUTIVA: dias, AGENDA_CONVIDAR_EQUIPES: /^n/i.test(String(v.convidarEquipes)) ? 'NÃO' : 'SIM' });
    registrarAcao_(quem_(), 'Ajustes da agenda salvos', '', '', horario || 'dia inteiro');
    return { ok: true };
  });
}

/** 📅 Cria/atualiza os eventos no Google Agenda (só o assistente: os convites saem da sua conta). */
function apiSincronizarAgenda(opcoes) {
  return api_(function () {
    if ((!ACESSO || !ACESSO.dono) && opcoes && opcoes.criar) throw new Error('Só o assistente cria a agenda (os convites saem da conta dele).');
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return { ocupado: true };
    try {
      const est = lerMapaAgenda_('AGENDA_ESTADO');
      if (!est.id && !(opcoes && opcoes.criar)) return { naoCriada: true };
      return sincronizarAgenda_();
    } finally {
      lock.releaseLock();
    }
  });
}

/** 📅 Põe, muda ou tira um dia de uma aula pelo calendário.
 *  campo: 'aula' (Data da aula) | 'prazo' (Recebe entregas até); data 'yyyy-MM-dd' ou '' para tirar. */
function apiAgendaData(idAula, campo, data) {
  return api_(function () {
    const coluna = { aula: 'DATA_AULA', prazo: 'RECEBE_ATE', inicio: 'RECEBE_DE' }[campo];
    if (!coluna) throw new Error('Campo inválido.');
    if (data && !/^\d{4}-\d{2}-\d{2}$/.test(String(data))) throw new Error('Data inválida.');
    const tz = planilha_().getSpreadsheetTimeZone();
    const r = comTrava_(function () {
      const a = lerAba_(ESQUEMA.AULAS).filter(function (x) { return String(x.ID_AULA) === String(idAula); })[0];
      if (!a) throw new Error('Aula não encontrada (atualize o app).');
      const nova = data ? Utilities.parseDate(data + ' 00:00', tz, 'yyyy-MM-dd HH:mm') : '';
      const de = coluna === 'RECEBE_DE' ? nova : a.RECEBE_DE, ate = coluna === 'RECEBE_ATE' ? nova : a.RECEBE_ATE;
      if (de instanceof Date && ate instanceof Date && ate < de) throw new Error('O prazo de entrega não pode ser antes do início das entregas (' + Utilities.formatDate(de, tz, 'dd/MM') + ').');
      const sh = planilha_().getSheetByName(ESQUEMA.AULAS.nome);
      const col = ESQUEMA.AULAS.colunas.map(function (c) { return c.chave; }).indexOf(coluna) + 1;
      sh.getRange(a._linha, col).setValue(nova);
      const nomes = { DATA_AULA: 'Dia da aula', RECEBE_ATE: 'Prazo de entrega', RECEBE_DE: 'Início das entregas' };
      registrarAcao_(quem_(), (data ? 'Data mudada: ' : 'Data tirada: ') + nomes[coluna], 'Aula ' + a.NUMERO, '', data ? Utilities.formatDate(nova, tz, 'dd/MM/yyyy') : 'sem data');
      return { ok: true };
    });
    r.agenda = sincronizarSePuder_();
    return r;
  });
}

/** 📌 Compromissos avulsos (feriado, reunião, sem aula…). acao: 'salvar' | 'excluir'. */
function apiAgendaExtra(acao, x) {
  return api_(function () {
    x = x || {};
    const lista = lerExtras_();
    if (acao === 'excluir') {
      const i = lista.map(function (e) { return e.id; }).indexOf(String(x.id));
      if (i === -1) throw new Error('Compromisso não encontrado.');
      registrarAcao_(quem_(), 'Compromisso tirado da agenda', '', '', lista[i].titulo + ' (' + lista[i].data + ')');
      lista.splice(i, 1);
    } else {
      const titulo = String(x.titulo || '').trim().slice(0, 120);
      if (!titulo) throw new Error('Dê um nome ao compromisso.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(x.data || ''))) throw new Error('Data inválida.');
      const horario = String(x.horario || '').trim();
      if (horario && !lerHorario_(horario)) throw new Error('Horário inválido. Use 14:00-15:00 ou deixe vazio (dia inteiro).');
      const item = { id: x.id || ('X' + Date.now().toString(36)), data: x.data, titulo: titulo, horario: horario,
        para: x.para === 'professores' ? 'professores' : 'todos', obs: String(x.obs || '').trim().slice(0, 500) };
      const i = lista.map(function (e) { return e.id; }).indexOf(item.id);
      if (i === -1) lista.push(item); else lista[i] = item;
      registrarAcao_(quem_(), 'Compromisso na agenda', '', '', titulo + ' (' + x.data + ')');
    }
    salvarMapaAgenda_('AGENDA_EXTRAS', { lista: lista });
    return { ok: true, agenda: sincronizarSePuder_() };
  });
}

function lerExtras_() { return (lerMapaAgenda_('AGENDA_EXTRAS').lista || []); }

/** Se a agenda já existe, atualiza o Google Agenda na hora (os convites saem da conta do assistente). */
function sincronizarSePuder_() {
  if (!lerMapaAgenda_('AGENDA_ESTADO').id) return null;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ocupado: true };
  try { return sincronizarAgenda_(); } catch (e) { return { erro: e.message }; } finally { lock.releaseLock(); }
}

/* ------------------------------------------------------------------ */
/*  SINCRONIZAÇÃO                                                      */
/* ------------------------------------------------------------------ */

function sincronizarAgenda_() {
  const inicio = Date.now();
  const cfg = configAgenda_();
  const tz = planilha_().getSpreadsheetTimeZone();
  const cal = agenda_(tz);
  const est = lerMapaAgenda_('AGENDA_ESTADO');
  const eventos = lerMapaAgenda_('AGENDA_EVENTOS'); // chave -> { id, assinatura }
  const professores = extrairEmails_(cfg.EMAIL_PROFESSOR);
  const alunos = sim_(cfg.AGENDA_CONVIDAR_EQUIPES)
    ? lerAba_(ESQUEMA.EQUIPES).reduce(function (t, q) { return t.concat(extrairEmails_(q.EMAILS)); }, []) : [];
  const eu = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const unicos = function (l) { return l.filter(function (x, i) { return x && x !== eu && l.indexOf(x) === i; }); };
  const todos = unicos(professores.concat(alunos));
  const internos = unicos(professores.slice());

  // Eventos que devem existir
  const desejados = {};
  lerAba_(ESQUEMA.AULAS).forEach(function (a) {
    const id = String(a.ID_AULA);
    const nome = 'Aula ' + a.NUMERO + (a.TITULO ? ' — ' + a.TITULO : '');
    const pedido = itensAula_(a.ENTREGAVEIS);
    const assunto = assuntoPadrao_(cfg.ASSUNTO_PREFIXO, a.NUMERO, 'Nome da sua equipe');
    const enviarPara = extrairEmails_(cfg.EMAIL_ENTREGAS)[0] || eu;
    const instrucoes = (pedido.length ? 'O que entregar:\n' + pedido.map(function (x) { return '• ' + x; }).join('\n') + '\n\n' : '') +
      'Como entregar: e-mail para ' + enviarPara + '\nAssunto: ' + assunto +
      (a.RECEBE_ATE instanceof Date ? '\nPrazo: até ' + Utilities.formatDate(a.RECEBE_ATE, tz, 'dd/MM/yyyy') + ' às ' + cfg.AGENDA_HORA_PRAZO : '');

    if (a.DATA_AULA instanceof Date) {
      const h = lerHorario_(cfg.AGENDA_HORARIO_AULA);
      desejados[id + '|aula'] = { titulo: '📚 ' + nome, dia: a.DATA_AULA, horario: h, convidados: todos, descricao: instrucoes };
    }
    if (a.RECEBE_ATE instanceof Date) {
      const hp = lerHora_(cfg.AGENDA_HORA_PRAZO) || { h: 23, m: 59 };
      const fim = hp.h * 60 + hp.m, ini = Math.max(fim - 30, 0);
      desejados[id + '|prazo'] = { titulo: '⏰ Prazo de entrega — ' + nome, dia: a.RECEBE_ATE,
        horario: { ini: { h: Math.floor(ini / 60), m: ini % 60 }, fim: hp }, convidados: todos, descricao: instrucoes };
    }
    const dev = prazoDevolutiva_(a, cfg);
    if (dev) {
      desejados[id + '|devolutiva'] = { titulo: '📝 Devolutivas — ' + nome + ' (interno)', dia: dev, horario: null, convidados: internos,
        descricao: 'Lembrete interno (só professores e assistente):\nrevisar, ajustar e aprovar as devolutivas desta aula no app, para que sejam enviadas às equipes.' };
    }
  });

  lerExtras_().forEach(function (x) {
    desejados['extra|' + x.id] = { titulo: '📌 ' + x.titulo, dia: Utilities.parseDate(x.data + ' 12:00', tz, 'yyyy-MM-dd HH:mm'),
      horario: lerHorario_(x.horario), convidados: x.para === 'professores' ? internos : todos,
      descricao: (x.obs ? x.obs + '\n\n' : '') + (x.para === 'professores' ? 'Compromisso interno (professores e assistente).' : 'Consultoria — compromisso para todos.') };
  });

  let criados = 0, atualizados = 0, removidos = 0, restantes = 0;
  const falhas = [];
  const chaves = Object.keys(desejados);
  for (let i = 0; i < chaves.length; i++) {
    if (Date.now() - inicio > 4 * 60 * 1000) { restantes = chaves.length - i; break; }
    const k = chaves[i], d = desejados[k];
    try {
      const r = aplicarEvento_(cal, eventos[k], d, tz);
      if (r.criado) criados++; else if (r.mudou) atualizados++;
      eventos[k] = { id: r.id, assinatura: r.assinatura, convidados: d.convidados.slice().sort().join(',') };
    } catch (err) {
      falhas.push(d.titulo + ': ' + err.message);
    }
  }
  // Aulas excluídas ou sem data: tira da agenda
  if (!restantes) {
    Object.keys(eventos).forEach(function (k) {
      if (desejados[k]) return;
      try { const ev = cal.getEventById(eventos[k].id); if (ev) ev.deleteEvent(); } catch (err) { /* já não existe */ }
      delete eventos[k];
      removidos++;
    });
  }
  salvarMapaAgenda_('AGENDA_EVENTOS', eventos);
  est.em = Utilities.formatDate(new Date(), tz, 'dd/MM HH:mm');
  salvarMapaAgenda_('AGENDA_ESTADO', est);
  if (criados || atualizados || removidos) {
    registrarAcao_(quem_(), 'Google Agenda atualizado', '', '', criados + ' criado(s), ' + atualizados + ' atualizado(s), ' + removidos + ' removido(s)');
  }
  return { criados: criados, atualizados: atualizados, removidos: removidos, falhas: falhas, restantes: restantes,
    convidados: todos.length, url: 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(cal.getId()) };
}

/** Cria o evento ou ajusta só o que mudou (sem reenviar convites à toa). */
function aplicarEvento_(cal, salvo, d, tz) {
  const diaTxt = Utilities.formatDate(d.dia, tz, 'yyyy-MM-dd');
  const quando = function (hm) { return Utilities.parseDate(diaTxt + ' ' + pad_(hm.h) + ':' + pad_(hm.m), tz, 'yyyy-MM-dd HH:mm'); };
  const diaInteiro = !d.horario;
  const ini = diaInteiro ? Utilities.parseDate(diaTxt + ' 12:00', tz, 'yyyy-MM-dd HH:mm') : quando(d.horario.ini);
  const fim = diaInteiro ? null : quando(d.horario.fim);
  const assinatura = [d.titulo, diaTxt, diaInteiro ? 'dia' : pad_(d.horario.ini.h) + pad_(d.horario.ini.m) + '-' + pad_(d.horario.fim.h) + pad_(d.horario.fim.m), d.descricao].join('¦');

  let ev = null;
  if (salvo && salvo.id) { try { ev = cal.getEventById(salvo.id); } catch (e) { ev = null; } }
  if (ev && ev.isAllDayEvent() !== diaInteiro) { try { ev.deleteEvent(); } catch (e) { /* ok */ } ev = null; }

  if (!ev) {
    const op = { description: d.descricao, guests: d.convidados.join(','), sendInvites: true };
    ev = diaInteiro ? cal.createAllDayEvent(d.titulo, ini, op) : cal.createEvent(d.titulo, ini, fim, op);
    ev.setGuestsCanSeeOtherGuests(false);
    ev.setGuestsCanInviteOthers(false);
    Utilities.sleep(250); // o Google limita a criação muito rápida de eventos
    return { id: ev.getId(), assinatura: assinatura, criado: true };
  }

  let mudou = false;
  if (!salvo || salvo.assinatura !== assinatura) {
    ev.setTitle(d.titulo);
    ev.setDescription(d.descricao);
    if (diaInteiro) ev.setAllDayDate(ini); else ev.setTime(ini, fim);
    mudou = true;
  }
  const atuais = ev.getGuestList().map(function (g) { return String(g.getEmail()).toLowerCase(); });
  d.convidados.forEach(function (e) { if (atuais.indexOf(e) === -1) { ev.addGuest(e); mudou = true; } });
  atuais.forEach(function (e) { if (d.convidados.indexOf(e) === -1) { ev.removeGuest(e); mudou = true; } });
  return { id: ev.getId(), assinatura: assinatura, mudou: mudou };
}

/** A agenda "Consultoria — Aulas e Entregas" (cria na primeira vez). */
function agenda_(tz) {
  const est = lerMapaAgenda_('AGENDA_ESTADO');
  if (est.id) {
    const c = CalendarApp.getCalendarById(est.id);
    if (c) return c;
  }
  const c = CalendarApp.createCalendar(NOME_AGENDA, { timeZone: tz, color: CalendarApp.Color.BLUE,
    summary: 'Aulas, prazos de entrega e devolutivas da consultoria (criada pelo app).' });
  est.id = c.getId();
  salvarMapaAgenda_('AGENDA_ESTADO', est);
  salvarMapaAgenda_('AGENDA_EVENTOS', {}); // agenda nova: recria todos os eventos
  registrarAcao_(quem_(), 'Google Agenda criado', '', '', NOME_AGENDA);
  return c;
}

/* ------------------------------------------------------------------ */
/*  AUXILIARES                                                         */
/* ------------------------------------------------------------------ */

function prazoDevolutiva_(a, cfg) {
  if (!(a.RECEBE_ATE instanceof Date)) return null;
  const n = parseInt(cfg.AGENDA_DIAS_DEVOLUTIVA, 10);
  const d = new Date(a.RECEBE_ATE.getTime());
  d.setDate(d.getDate() + (isNaN(n) ? 3 : n));
  return d;
}

/** "19:00-22:00", "19h às 22h", "19h30 - 22h" → { ini, fim } */
function lerHorario_(t) {
  const m = String(t || '').match(/(\d{1,2})(?:[:h](\d{2}))?h?\s*(?:-|–|às|as|a|até)\s*(\d{1,2})(?:[:h](\d{2}))?/i);
  if (!m) return null;
  const ini = { h: +m[1], m: +(m[2] || 0) }, fim = { h: +m[3], m: +(m[4] || 0) };
  if (ini.h > 23 || fim.h > 23 || ini.m > 59 || fim.m > 59 || fim.h * 60 + fim.m <= ini.h * 60 + ini.m) return null;
  return { ini: ini, fim: fim };
}

function lerHora_(t) {
  const m = String(t || '').match(/^(\d{1,2})[:h](\d{2})(?::\d{2})?$/);
  return m && +m[1] <= 23 && +m[2] <= 59 ? { h: +m[1], m: +m[2] } : null;
}

function itensAula_(t) {
  return String(t || '').split(/\n+/).map(function (x) { return x.replace(/^[\s•\-–*\d.)]+/, '').trim(); }).filter(String);
}

function pad_(n) { return ('0' + n).slice(-2); }

/** Lê a Config com os parâmetros da agenda (cria os que faltarem). */
function configAgenda_() {
  PARAM_AGENDA.forEach(function (p) { garantirParametro_(p[0], p[1], p[2]); });
  const cfg = lerConfig_();
  const sh = planilha_().getSheetByName(ESQUEMA.CONFIG.nome);
  // getDisplayValues: "23:59" não vira data/hora da planilha
  sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).getDisplayValues().forEach(function (l) {
    const k = String(l[0]).trim();
    if (/^AGENDA_/.test(k)) cfg[k] = String(l[1] || '').trim();
  });
  PARAM_AGENDA.forEach(function (p) { if (cfg[p[0]] === undefined || (cfg[p[0]] === '' && p[0] !== 'AGENDA_HORARIO_AULA')) cfg[p[0]] = p[1]; });
  return cfg;
}

function escreverConfigAgenda_(valores) {
  const sh = planilha_().getSheetByName(ESQUEMA.CONFIG.nome);
  const chaves = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (l) { return String(l[0]).trim(); });
  Object.keys(valores).forEach(function (k) {
    const i = chaves.indexOf(k);
    if (i !== -1) sh.getRange(i + 2, 2).setNumberFormat('@').setValue(valores[k]);
  });
}

function lerMapaAgenda_(chave) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(chave) || '{}'); } catch (e) { return {}; }
}

function salvarMapaAgenda_(chave, obj) {
  PropertiesService.getScriptProperties().setProperty(chave, JSON.stringify(obj));
}

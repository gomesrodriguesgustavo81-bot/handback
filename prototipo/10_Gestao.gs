/**
 * =====================================================================
 *  Arquivo 10_Gestao — PASSO 9
 *  O app vira o lugar de trabalho; a planilha é só o "motor":
 *   • Aulas: criar, editar, excluir + instruções para as equipes
 *   • Equipes: criar, editar, excluir
 *   • Ajustes (só o assistente): professores (vários, cada um com
 *     link pessoal), configurações e verificação da instalação
 *  Todos os e-mails continuam saindo da conta do assistente.
 * =====================================================================
 */

const VERSAO_GESTAO = 'Passo 9 · 2026-11-20';

/** Parâmetros da Config editáveis pelo app (os demais ficam só na planilha). */
const CONFIG_EDITAVEL = [
  ['NOME_PROFESSOR', 'Nome que aparece como remetente das devolutivas', 'texto'],
  ['ASSINATURA_PROFESSOR', 'Assinatura no fim das devolutivas', 'longo'],
  ['PROFESSOR_EM_COPIA', 'Professores em cópia nas devolutivas', 'simnao'],
  ['EMAIL_ENTREGAS', 'Seu e-mail (para onde as equipes enviam)', 'texto'],
  ['ASSUNTO_PREFIXO', 'Etiqueta do assunto (ex.: [ENTREGA])', 'texto'],
  ['MOSTRAR_CONCEITO_NO_EMAIL', 'Mostrar o conceito no e-mail da devolutiva', 'simnao'],
  ['MOSTRAR_CHECKLIST_NO_EMAIL', 'Mostrar o checklist no e-mail da devolutiva', 'simnao'],
  ['REGRA_CHECKLIST', 'Conceito segue o checklist (faltou item → REGULAR…)', 'simnao'],
  ['MODO_ENTREGA', 'E-mails fora do padrão com anexo', 'modo'],
  ['MODELO_IA', 'Modelo principal do Gemini', 'texto'],
  ['MODELO_IA_RESERVA', 'Modelo reserva do Gemini', 'texto'],
  ['CONCEITO_EXCELENTE', 'O que é EXCELENTE', 'longo'],
  ['CONCEITO_BOM', 'O que é BOM', 'longo'],
  ['CONCEITO_REGULAR', 'O que é REGULAR', 'longo'],
  ['CONCEITO_RUIM', 'O que é RUIM', 'longo'],
  ['FEEDBACK_EXEMPLOS', 'Feedbacks aprovados que a IA imita (separe com uma linha ---)', 'longo'],
  ['ASSUNTOS_IGNORAR', 'Palavras de assunto que NÃO são entrega (separadas por vírgula)', 'longo']
];

/* ------------------------------------------------------------------ */
/*  LEITURA PARA O APP                                                 */
/* ------------------------------------------------------------------ */

function apiGestao() {
  return api_(function () {
    const tz = planilha_().getSpreadsheetTimeZone();
    const iso = function (d) { return d instanceof Date ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : ''; };
    const entregas = lerAba_(ESQUEMA.ENTREGAS);
    const contar = function (campo, id) { return entregas.filter(function (e) { return String(e[campo]) === String(id); }).length; };
    const dono = !!(ACESSO && ACESSO.dono);
    const cfg = lerConfig_();
    return {
      dono: dono,
      aulas: lerAba_(ESQUEMA.AULAS).sort(function (a, b) { return Number(a.NUMERO) - Number(b.NUMERO); }).map(function (a) {
        return {
          id: String(a.ID_AULA), numero: a.NUMERO, titulo: String(a.TITULO || ''), dataAula: iso(a.DATA_AULA),
          recebeDe: iso(a.RECEBE_DE), recebeAte: iso(a.RECEBE_ATE), entregaveis: String(a.ENTREGAVEIS || ''),
          metricas: String(a.METRICAS || ''), observacoes: String(a.OBSERVACOES || ''), status: String(a.STATUS || ''),
          entregas: contar('ID_AULA', a.ID_AULA)
        };
      }),
      equipes: lerAba_(ESQUEMA.EQUIPES).map(function (q) {
        return { id: String(q.ID_EQUIPE), nome: String(q.NOME || ''), tema: String(q.TEMA || ''),
          emails: extrairEmails_(q.EMAILS).join(', '), obs: String(q.OBS || ''), entregas: contar('ID_EQUIPE', q.ID_EQUIPE) };
      }),
      config: dono ? CONFIG_EDITAVEL.map(function (p) { return { chave: p[0], rotulo: p[1], tipo: p[2], valor: String(cfg[p[0]] || '') }; }) : [],
      professores: dono ? lerLinks_().map(function (p) {
        return { id: p.hash.slice(0, 12), nome: p.nome, email: p.email || '', criadoEm: p.criadoEm ? Utilities.formatDate(new Date(p.criadoEm), tz, 'dd/MM/yyyy') : '' };
      }) : [],
      appPublicado: !!ScriptApp.getService().getUrl()
    };
  });
}

/* ------------------------------------------------------------------ */
/*  AULAS                                                              */
/* ------------------------------------------------------------------ */

function apiSalvarAula(a) {
  return api_(function () {
    return comTrava_(function () {
      const aulas = lerAba_(ESQUEMA.AULAS);
      const numero = Number(a.numero);
      if (!numero || numero < 1) throw new Error('Informe o número da aula.');
      if (!String(a.titulo || '').trim()) throw new Error('Informe o título da aula.');
      const de = dataDeIso_(a.recebeDe), ate = dataDeIso_(a.recebeAte);
      if (!de || !ate) throw new Error('Informe as datas "Recebe entregas de" e "até".');
      if (de > ate) throw new Error('"Recebe de" está depois de "Recebe até".');
      if (!itensDoPedido_(a.entregaveis).length) throw new Error('Informe o que deve ser entregue (um item por linha).');
      const repetida = aulas.find(function (x) { return Number(x.NUMERO) === numero && String(x.ID_AULA) !== String(a.id || ''); });
      if (repetida) throw new Error('Já existe a Aula ' + numero + ' (' + repetida.TITULO + ').');

      const existente = a.id ? aulas.find(function (x) { return String(x.ID_AULA) === String(a.id); }) : null;
      const id = existente ? existente.ID_AULA : novoIdSequencial_(aulas.map(function (x) { return x.ID_AULA; }), 'A');
      const reg = {
        ID_AULA: id, NUMERO: numero, TITULO: textoSeguro_(a.titulo), DATA_AULA: dataDeIso_(a.dataAula) || '',
        RECEBE_DE: de, RECEBE_ATE: ate, ENTREGAVEIS: textoSeguro_(a.entregaveis), METRICAS: textoSeguro_(a.metricas),
        OBSERVACOES: textoSeguro_(a.observacoes),
        STATUS: ['Planejada', 'Recebendo', 'Analisada', 'Concluída'].indexOf(a.status) !== -1 ? a.status : (existente ? existente.STATUS || 'Planejada' : 'Planejada')
      };
      gravarLinhaDef_(ESQUEMA.AULAS, existente ? existente._linha : null, reg);
      registrarAcao_(quem_(), existente ? 'Aula editada' : 'Aula criada', 'Aula ' + numero + ' — ' + reg.TITULO, '', '');
      return { id: id };
    });
  });
}

function apiExcluirAula(id) {
  return api_(function () {
    return comTrava_(function () {
      const a = lerAba_(ESQUEMA.AULAS).find(function (x) { return String(x.ID_AULA) === String(id); });
      if (!a) throw new Error('Aula não encontrada.');
      const n = lerAba_(ESQUEMA.ENTREGAS).filter(function (e) { return String(e.ID_AULA) === String(id); }).length;
      if (n) throw new Error('Esta aula já tem ' + n + ' entrega(s) registrada(s): não dá para excluir (o histórico seria perdido). Você pode editá-la.');
      planilha_().getSheetByName(ESQUEMA.AULAS.nome).deleteRow(a._linha);
      registrarAcao_(quem_(), 'Aula excluída', 'Aula ' + a.NUMERO + ' — ' + a.TITULO, '', '');
      return { ok: true };
    });
  });
}

/** 📋 Texto pronto para mandar às equipes (prazo, o que entregar, assunto de cada uma). */
function apiInstrucoesAula(id) {
  return api_(function () {
    const cfg = lerConfig_();
    const a = lerAba_(ESQUEMA.AULAS).find(function (x) { return String(x.ID_AULA) === String(id); });
    if (!a) throw new Error('Aula não encontrada.');
    const equipes = lerAba_(ESQUEMA.EQUIPES);
    const destino = extrairEmails_(cfg.EMAIL_ENTREGAS)[0] || Session.getEffectiveUser().getEmail();
    const texto = [
      'Olá, equipes!', '',
      'Entrega da Aula ' + a.NUMERO + ' — ' + a.TITULO,
      'Prazo: até ' + fmtData_(a.RECEBE_ATE) + ' (23:59).', '',
      'O que entregar:',
      itensDoPedido_(a.ENTREGAVEIS).map(function (i) { return '• ' + i; }).join('\n'), '',
      'Como enviar:',
      '• Para: ' + destino,
      '• Qualquer integrante pode enviar, a partir do e-mail cadastrado.',
      '• Anexe os arquivos (PDF, imagens etc.) ou cole os links do Google Docs/Slides no corpo do e-mail.',
      '• Use EXATAMENTE o assunto da sua equipe:', '',
      equipes.map(function (e) { return '   ' + e.NOME + ':  ' + assuntoPadrao_(cfg.ASSUNTO_PREFIXO, a.NUMERO, e.NOME); }).join('\n'), '',
      'Se precisar reenviar, use o mesmo assunto: vale o último envio dentro do prazo.', '',
      String(cfg.ASSINATURA_PROFESSOR || '')
    ].join('\n');
    return { texto: texto };
  });
}

/* ------------------------------------------------------------------ */
/*  EQUIPES                                                            */
/* ------------------------------------------------------------------ */

function apiSalvarEquipe(q) {
  return api_(function () {
    return comTrava_(function () {
      const equipes = lerAba_(ESQUEMA.EQUIPES);
      const nome = String(q.nome || '').trim();
      if (!nome) throw new Error('Informe o nome da equipe.');
      const emails = extrairEmails_(q.emails);
      if (!emails.length) throw new Error('Informe pelo menos um e-mail de integrante.');
      const existente = q.id ? equipes.find(function (x) { return String(x.ID_EQUIPE) === String(q.id); }) : null;
      equipes.forEach(function (x) {
        if (existente && x === existente) return;
        if (normalizar_(x.NOME) === normalizar_(nome)) throw new Error('Já existe uma equipe com o nome "' + nome + '".');
        const em = extrairEmails_(x.EMAILS).filter(function (e) { return emails.indexOf(e) !== -1; });
        if (em.length) throw new Error('O e-mail ' + em[0] + ' já está na equipe "' + x.NOME + '".');
      });
      const id = existente ? existente.ID_EQUIPE : novoIdSequencial_(equipes.map(function (x) { return x.ID_EQUIPE; }), 'E');
      gravarLinhaDef_(ESQUEMA.EQUIPES, existente ? existente._linha : null,
        { ID_EQUIPE: id, NOME: textoSeguro_(nome), TEMA: textoSeguro_(q.tema), EMAILS: emails.join(', '), OBS: textoSeguro_(q.obs) });
      registrarAcao_(quem_(), existente ? 'Equipe editada' : 'Equipe criada', '', nome, emails.length + ' e-mail(s)');
      return { id: id, aviso: existente && normalizar_(existente.NOME) !== normalizar_(nome)
        ? 'O nome mudou: as entregas antigas continuam ligadas à equipe (pelo ID), mas o assunto padrão passa a usar o nome novo.' : '' };
    });
  });
}

function apiExcluirEquipe(id) {
  return api_(function () {
    return comTrava_(function () {
      const q = lerAba_(ESQUEMA.EQUIPES).find(function (x) { return String(x.ID_EQUIPE) === String(id); });
      if (!q) throw new Error('Equipe não encontrada.');
      const n = lerAba_(ESQUEMA.ENTREGAS).filter(function (e) { return String(e.ID_EQUIPE) === String(id); }).length;
      if (n) throw new Error('Esta equipe já tem ' + n + ' entrega(s): não dá para excluir (o histórico seria perdido). Você pode editá-la.');
      planilha_().getSheetByName(ESQUEMA.EQUIPES.nome).deleteRow(q._linha);
      registrarAcao_(quem_(), 'Equipe excluída', '', q.NOME, '');
      return { ok: true };
    });
  });
}

/* ------------------------------------------------------------------ */
/*  AJUSTES (só o assistente)                                          */
/* ------------------------------------------------------------------ */

function exigirDono_() {
  if (!ACESSO || !ACESSO.dono) throw new Error('Só o assistente pode mudar os ajustes.');
}

function apiSalvarConfig(valores) {
  return api_(function () {
    exigirDono_();
    return comTrava_(function () {
      const sh = planilha_().getSheetByName(ESQUEMA.CONFIG.nome);
      const chaves = sh.getLastRow() >= 2 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(function (l) { return String(l[0]).trim(); }) : [];
      const permitidas = CONFIG_EDITAVEL.map(function (p) { return p[0]; });
      const mudou = [];
      Object.keys(valores || {}).forEach(function (k) {
        if (permitidas.indexOf(k) === -1) return;
        const v = textoSeguro_(valores[k]);
        const i = chaves.indexOf(k);
        if (i === -1) { sh.appendRow([k, v, '']); chaves.push(k); }
        else sh.getRange(i + 2, 2).setValue(v);
        mudou.push(k);
      });
      registrarAcao_(quem_(), 'Ajustes alterados', '', '', mudou.join(', '));
      return { alterados: mudou.length };
    });
  });
}

/** 🩺 Verificação da instalação, para mostrar no app. */
function apiVerificar() {
  return api_(function () {
    exigirDono_();
    return { linhas: diagnostico_().linhas };
  });
}

/**
 * Professores: acao = 'adicionar' {nome, email, enviar} | 'revogar' {id} | 'reenviar' {id}.
 * Cada professor tem o próprio link pessoal (só o resumo fica guardado para validar;
 * o link em si fica guardado só para os avisos por e-mail, nas Propriedades do Script).
 */
function apiProfessores(acao, dados) {
  return api_(function () {
    exigirDono_();
    return comTrava_(function () {
      const props = PropertiesService.getScriptProperties();
      const links = lerLinks_();
      const planos = lerLinksPlanos_();
      const d = dados || {};
      if (acao === 'adicionar') {
        const url = ScriptApp.getService().getUrl();
        if (!url) throw new Error('Publique o app primeiro (Implantar › Nova implantação › App da Web).');
        const nome = String(d.nome || '').trim();
        const email = extrairEmails_(d.email)[0] || '';
        if (!nome) throw new Error('Informe o nome do professor.');
        if (d.enviar && !email) throw new Error('Informe o e-mail para enviar o link.');
        if (email && links.some(function (p) { return p.email === email; })) throw new Error('Este e-mail já tem acesso. Use "Reenviar link" ou revogue antes.');
        const chave = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
        const hash = resumoChave_(chave);
        links.push({ nome: nome, email: email, hash: hash, criadoEm: new Date().toISOString() });
        planos[hash] = url + '?k=' + chave;
        props.setProperty('LINKS_PESSOAIS', JSON.stringify(links));
        props.setProperty('LINKS_PLANOS', JSON.stringify(planos));
        if (d.enviar) enviarLinkProfessor_(nome, email, planos[hash]);
        sincronizarEmailsProfessores_(links);
        registrarAcao_(quem_(), 'Professor adicionado', '', '', nome + (email ? ' · ' + email : ''));
        return { link: planos[hash], enviado: !!d.enviar };
      }
      const alvo = links.find(function (p) { return p.hash.slice(0, 12) === String(d.id); });
      if (!alvo) throw new Error('Professor não encontrado.');
      if (acao === 'reenviar') {
        if (!alvo.email) throw new Error('Este professor não tem e-mail cadastrado.');
        if (!planos[alvo.hash]) throw new Error('Link antigo indisponível: revogue e adicione de novo.');
        enviarLinkProfessor_(alvo.nome, alvo.email, planos[alvo.hash]);
        return { enviado: true };
      }
      if (acao === 'revogar') {
        const restantes = links.filter(function (p) { return p !== alvo; });
        props.setProperty('LINKS_PESSOAIS', JSON.stringify(restantes));
        sincronizarEmailsProfessores_(restantes);
        delete planos[alvo.hash];
        props.setProperty('LINKS_PLANOS', JSON.stringify(planos));
        registrarAcao_(quem_(), 'Acesso de professor revogado', '', '', alvo.nome);
        return { ok: true };
      }
      throw new Error('Ação desconhecida.');
    });
  });
}

/** 📣 Avisa TODOS os professores (cada um com o próprio link) que a aula está pronta. */
function avisarTodosProfessores_(idAula) {
  const links = lerLinks_().filter(function (p) { return p.email; });
  const planos = lerLinksPlanos_();
  if (!links.length) return null; // sem professores cadastrados pelo app
  const aula = lerAba_(ESQUEMA.AULAS).find(function (a) { return String(a.ID_AULA) === String(idAula); });
  const ents = lerAba_(ESQUEMA.ENTREGAS).filter(function (e) { return String(e.ID_AULA) === String(idAula); });
  const aguardando = ents.filter(function (e) { return e.STATUS === ST_ANALISADA; }).length;
  const titulo = aula ? 'Aula ' + aula.NUMERO + ' — ' + aula.TITULO : 'a aula';
  links.forEach(function (p) {
    const link = planos[p.hash] || ScriptApp.getService().getUrl();
    MailApp.sendEmail({
      to: p.email,
      subject: 'Devolutivas prontas para revisão: ' + titulo,
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">' +
        '<p>Olá, ' + escaparTexto_(p.nome) + '!</p>' +
        '<p>A análise de <b>' + escaparTexto_(titulo) + '</b> está pronta: <b>' + aguardando + '</b> devolutiva(s) aguardando aprovação.</p>' +
        '<p><a href="' + link + '" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">Revisar e aprovar</a></p></div>',
      body: 'A análise de ' + titulo + ' está pronta (' + aguardando + ' aguardando aprovação): ' + link
    });
  });
  registrarAcao_(quem_(), 'Professores avisados', titulo, '', links.map(function (p) { return p.nome; }).join(', '));
  return { ok: true, aguardando: aguardando, avisados: links.length };
}

/* ------------------------------------------------------------------ */
/*  APOIO                                                              */
/* ------------------------------------------------------------------ */

/**
 * Mantém Config › EMAIL_PROFESSOR com o e-mail de TODOS os professores cadastrados
 * (usado para a cópia nas devolutivas e para não confundir e-mail de professor com entrega).
 */
function sincronizarEmailsProfessores_(links) {
  const emails = links.map(function (p) { return p.email; }).filter(function (e, i, a) { return e && a.indexOf(e) === i; });
  if (!emails.length) return;
  const sh = planilha_().getSheetByName(ESQUEMA.CONFIG.nome);
  const chaves = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().map(function (l) { return String(l[0]).trim(); });
  const i = chaves.indexOf('EMAIL_PROFESSOR');
  if (i === -1) sh.appendRow(['EMAIL_PROFESSOR', emails.join(', '), 'E-mails dos professores (mantido pelo app).']);
  else sh.getRange(i + 2, 2).setValue(emails.join(', '));
}

function lerLinksPlanos_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('LINKS_PLANOS') || '{}'); }
  catch (e) { return {}; }
}

function enviarLinkProfessor_(nome, email, link) {
  MailApp.sendEmail({
    to: email,
    subject: 'Seu acesso ao app de avaliação das entregas',
    htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">' +
      '<p>Olá, ' + escaparTexto_(nome) + '!</p>' +
      '<p>Este é o seu link pessoal para revisar e aprovar as devolutivas das equipes:</p>' +
      '<p><a href="' + link + '" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">Abrir o app</a></p>' +
      '<p style="color:#64748b;font-size:12px">O link é pessoal: não encaminhe. Abra logado em qualquer conta Google. No celular, use "Adicionar à tela inicial".</p></div>',
    body: 'Seu link pessoal: ' + link
  });
}

function dataDeIso_(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** Impede que um texto digitado vire fórmula na planilha. */
function textoSeguro_(t) {
  t = String(t === null || t === undefined ? '' : t).trim();
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function novoIdSequencial_(existentes, prefixo) {
  let n = 1, id;
  const usados = existentes.map(String);
  do { id = prefixo + ('0' + n).slice(-2); n++; } while (usados.indexOf(id) !== -1);
  return id;
}

/** Grava uma linha inteira numa aba (nova no fim, ou substitui a linha indicada). */
function gravarLinhaDef_(def, linha, obj) {
  const sh = planilha_().getSheetByName(def.nome);
  const valores = def.colunas.map(function (c) { return obj[c.chave] === undefined || obj[c.chave] === null ? '' : obj[c.chave]; });
  if (linha) sh.getRange(linha, 1, 1, valores.length).setValues([valores]);
  else sh.appendRow(valores);
}

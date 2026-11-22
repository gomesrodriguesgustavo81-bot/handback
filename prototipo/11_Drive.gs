/**
 * =====================================================================
 *  Arquivo 11_Drive — PASSO 10
 *  Organiza os arquivos das entregas no Google Drive (na SUA conta):
 *    Entregas — Consultoria / <Equipe> / Aula N — Título / arquivos
 *  • anexos do e-mail (e imagens coladas no corpo) com a data no nome
 *  • um arquivo "links" com os links que a equipe mandou no e-mail
 *  • roda sozinho depois do 📥 Buscar e ao confirmar uma entrega
 *  • nada é salvo duas vezes; reenvios (versões antigas) também ficam
 * =====================================================================
 */

const VERSAO_DRIVE = 'Passo 10 · 2026-11-19';
const NOME_PASTA_RAIZ = 'Entregas — Consultoria';

/** Registra as funções deste arquivo no app (o 07_Aprovacao lê este registro). */
var API_EXTRA = (typeof API_EXTRA !== 'undefined' && API_EXTRA) || {};
API_EXTRA.apiSincronizarDrive = function () { return apiSincronizarDrive.apply(null, arguments); };
API_EXTRA.apiPastasDrive = function () { return apiPastasDrive.apply(null, arguments); };
API_EXTRA.apiCompartilharDrive = function () { return apiCompartilharDrive.apply(null, arguments); };

/* ------------------------------------------------------------------ */
/*  APIs                                                               */
/* ------------------------------------------------------------------ */

/** 📁 Salva no Drive os arquivos das entregas que ainda não foram salvos. */
function apiSincronizarDrive() {
  return api_(function () {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return { ocupado: true, novos: 0, arquivos: 0 };
    try {
      return sincronizarDrive_();
    } finally {
      lock.releaseLock();
    }
  });
}

/** Links das pastas (raiz e de cada equipe) para mostrar no app. */
function apiPastasDrive() {
  return api_(function () {
    const mapa = lerMapa_('DRIVE_PASTAS');
    const pastas = {};
    Object.keys(mapa).forEach(function (k) {
      if (k.indexOf('|') === -1 && k !== 'RAIZ') pastas[k] = 'https://drive.google.com/drive/folders/' + mapa[k];
    });
    return { raiz: mapa.RAIZ ? 'https://drive.google.com/drive/folders/' + mapa.RAIZ : '', pastas: pastas };
  });
}

/** 👥 Dá acesso de LEITURA à pasta das entregas para todos os professores cadastrados. */
function apiCompartilharDrive() {
  return api_(function () {
    if (!ACESSO || !ACESSO.dono) throw new Error('Só o assistente pode compartilhar a pasta.');
    const raiz = pastaRaiz_();
    const emails = extrairEmails_(lerConfig_().EMAIL_PROFESSOR);
    if (!emails.length) throw new Error('Cadastre os professores (com e-mail) em Ajustes › Professores.');
    const ja = raiz.getViewers().concat(raiz.getEditors()).map(function (u) { return String(u.getEmail()).toLowerCase(); });
    const novos = emails.filter(function (e) { return ja.indexOf(e) === -1; });
    novos.forEach(function (e) { raiz.addViewer(e); });
    registrarAcao_(quem_(), 'Pasta do Drive compartilhada', '', '', novos.join(', ') || 'todos já tinham acesso');
    return { compartilhados: novos.length, total: emails.length, url: raiz.getUrl() };
  });
}

/* ------------------------------------------------------------------ */
/*  SINCRONIZAÇÃO                                                      */
/* ------------------------------------------------------------------ */

function sincronizarDrive_() {
  const inicio = Date.now();
  const raiz = pastaRaiz_();
  const salvos = lerMapa_('DRIVE_SALVOS');
  const tz = planilha_().getSpreadsheetTimeZone();
  const pendentes = lerAba_(ESQUEMA.ENTREGAS).filter(function (e) {
    return e.ID_EMAIL && e.ID_EQUIPE && e.ID_AULA && !salvos[String(e.ID)] &&
      !/ignorad|poss[ií]vel/i.test(String(e.STATUS));
  });
  let novos = 0, arquivos = 0;
  const falhas = [];
  for (let i = 0; i < pendentes.length; i++) {
    if (Date.now() - inicio > 4 * 60 * 1000) break; // o resto fica para a próxima vez
    const e = pendentes[i];
    try {
      const pasta = pastaDaEntrega_(raiz, e);
      const msg = GmailApp.getMessageById(String(e.ID_EMAIL));
      if (!msg) throw new Error('e-mail não encontrado');
      const prefixo = Utilities.formatDate(msg.getDate(), tz, 'yyyy-MM-dd HH\'h\'mm') + ' - ';
      const existentes = {};
      const it = pasta.getFiles();
      while (it.hasNext()) existentes[it.next().getName()] = true;

      const anexos = msg.getAttachments({ includeInlineImages: false, includeAttachments: true });
      let coladas = [];
      try {
        coladas = msg.getAttachments({ includeInlineImages: true, includeAttachments: false })
          .filter(function (a) { return /^image\//i.test(a.getContentType()) && a.getSize() >= 30 * 1024; });
      } catch (err) { coladas = []; }
      anexos.concat(coladas).forEach(function (a, j) {
        const nome = prefixo + (a.getName() || ('imagem-' + (j + 1) + '.png'));
        if (existentes[nome]) return;
        pasta.createFile(a.copyBlob().setName(nome));
        existentes[nome] = true;
        arquivos++;
      });

      const corpo = (msg.getPlainBody() || '') + '\n' + (msg.getBody() || '');
      const links = (corpo.match(/https?:\/\/[^\s"'<>)\]]+/g) || [])
        .map(function (l) { return l.replace(/[.,;]+$/, ''); })
        .filter(function (l, k, arr) { return arr.indexOf(l) === k && !/mail\.google|accounts\.google|support\.google|unsubscribe|google\.com\/maps/i.test(l); });
      const nomeLinks = prefixo + 'links da entrega.txt';
      if (links.length && !existentes[nomeLinks]) {
        pasta.createFile(nomeLinks, 'Equipe: ' + e.EQUIPE + '\nAula: ' + e.AULA + '\nAssunto: ' + e.ASSUNTO +
          '\nEnviado por: ' + e.REMETENTE + '\n\nLinks:\n' + links.join('\n'), MimeType.PLAIN_TEXT);
        arquivos++;
      }
      salvos[String(e.ID)] = new Date().toISOString().slice(0, 10);
      novos++;
    } catch (err) {
      falhas.push(e.EQUIPE + ': ' + err.message);
    }
  }
  salvarMapa_('DRIVE_SALVOS', salvos);
  if (arquivos) registrarAcao_(quem_(), 'Arquivos salvos no Drive', '', '', arquivos + ' arquivo(s) de ' + novos + ' entrega(s)');
  return { novos: novos, arquivos: arquivos, falhas: falhas, restantes: pendentes.length - novos - falhas.length, raiz: raiz.getUrl() };
}

/** Pasta raiz: a da Config (PASTA_DRIVE) ou cria "Entregas — Consultoria" no seu Drive. */
function pastaRaiz_() {
  const mapa = lerMapa_('DRIVE_PASTAS');
  const cfg = lerConfig_();
  const idCfg = (String(cfg.PASTA_DRIVE || '').match(/[-\w]{25,}/) || [])[0];
  const id = idCfg || mapa.RAIZ;
  if (id) {
    try {
      const p = DriveApp.getFolderById(id);
      if (mapa.RAIZ !== id) { mapa.RAIZ = id; salvarMapa_('DRIVE_PASTAS', mapa); }
      return p;
    } catch (e) { /* pasta apagada ou sem acesso: cria outra */ }
  }
  const nova = DriveApp.createFolder(NOME_PASTA_RAIZ);
  mapa.RAIZ = nova.getId();
  salvarMapa_('DRIVE_PASTAS', mapa);
  gravarPastaNaConfig_(nova.getUrl());
  return nova;
}

/** Pasta Equipe / Aula da entrega (cria se não existir; lembra o ID). */
function pastaDaEntrega_(raiz, e) {
  const mapa = lerMapa_('DRIVE_PASTAS');
  const obter = function (chave, pai, nome) {
    if (mapa[chave]) {
      try { return DriveApp.getFolderById(mapa[chave]); } catch (err) { /* recria */ }
    }
    const it = pai.getFoldersByName(nome);
    const p = it.hasNext() ? it.next() : pai.createFolder(nome);
    mapa[chave] = p.getId();
    salvarMapa_('DRIVE_PASTAS', mapa);
    return p;
  };
  const limpar = function (t) { return String(t || 'Sem nome').replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 100); };
  const pastaEquipe = obter(String(e.ID_EQUIPE), raiz, limpar(e.EQUIPE));
  return obter(String(e.ID_EQUIPE) + '|' + String(e.ID_AULA), pastaEquipe, limpar(e.AULA));
}

function gravarPastaNaConfig_(url) {
  const sh = planilha_().getSheetByName(ESQUEMA.CONFIG.nome);
  const chaves = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().map(function (l) { return String(l[0]).trim(); });
  const i = chaves.indexOf('PASTA_DRIVE');
  if (i === -1) sh.appendRow(['PASTA_DRIVE', url, 'Pasta das entregas no Drive (criada pelo app).']);
  else sh.getRange(i + 2, 2).setValue(url);
}

function lerMapa_(chave) {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(chave) || '{}'); } catch (e) { return {}; }
}

function salvarMapa_(chave, obj) {
  PropertiesService.getScriptProperties().setProperty(chave, JSON.stringify(obj));
}

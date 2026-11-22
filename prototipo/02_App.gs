/**
 * =====================================================================
 *  Arquivo 02_App — PASSO 2
 *  App (celular + web), somente leitura nesta etapa:
 *  aulas, equipes, pedido de cada aula e histórico de cada equipe.
 *
 *  Publicação: Implantar › Nova implantação › App da Web
 *    Executar como: Eu
 *    Quem pode acessar: Qualquer pessoa com Conta do Google
 *  Entram: você (dono) e quem tiver um LINK PESSOAL válido (professor),
 *  gerado em 07_Aprovacao (função gerarLinkProfessor).
 *
 *  Lições aplicadas: nenhuma metatag arriscada; erros aparecem numa
 *  página explicativa; a versão aparece no rodapé do app.
 * =====================================================================
 */

const VERSAO_APP = 'Passo 5 · 2026-11-19';

/** Quem está usando o app nesta chamada (preenchido em doGet/apiRun). */
var ACESSO = null;

/** Entrega a tela do app. */
function doGet(e) {
  try {
    const token = String((e && e.parameter && e.parameter.k) || '').replace(/[^a-zA-Z0-9]/g, '');
    ACESSO = identificarUsuario_(token);
    if (!ACESSO) return paginaSimples_('🔒 Acesso restrito', 'Este app é de uso do assistente e do professor responsável. Peça o seu link pessoal de acesso.');
    const t = HtmlService.createTemplateFromFile('App');
    t.k = token;
    const saida = t.evaluate().setTitle('Consultoria — Entregas');
    try { saida.addMetaTag('viewport', 'width=device-width, initial-scale=1'); } catch (e) { /* o app abre mesmo assim */ }
    return saida;
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    const msg = String(err && err.message ? err.message : err);
    const dica = /App/.test(msg)
      ? 'Crie no Apps Script um arquivo HTML chamado exatamente App (aparece como App.html) e cole o conteúdo de App_COPIAR.txt.'
      : 'Rode 🩺 Verificar instalação na planilha e me envie o resultado.';
    return paginaSimples_('🛠️ O app não conseguiu abrir', msg, dica);
  }
}

/** Página simples de aviso/erro (sem depender do App.html). */
function paginaSimples_(titulo, mensagem, dica) {
  const esc = function (t) { return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  const saida = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;max-width:520px;margin:40px auto;padding:0 20px;color:#0f172a">' +
    '<h2>' + esc(titulo) + '</h2>' +
    '<p style="background:#f1f5f9;padding:12px;border-radius:10px;word-break:break-word">' + esc(mensagem) + '</p>' +
    (dica ? '<p><b>Como resolver:</b> ' + esc(dica) + '</p>' : '') +
    '<p style="color:#94a3b8;font-size:12px">' + esc(VERSAO_APP) + '</p></div>').setTitle(titulo);
  try { saida.addMetaTag('viewport', 'width=device-width, initial-scale=1'); } catch (e) { /* ignora */ }
  return saida;
}

/** Verdadeiro quando quem abre o app é o dono do script (você). */
function ehDono_() {
  const dono = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  const quem = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  return !!dono && quem === dono;
}

/**
 * Identifica quem usa o app: o dono (você) ou o professor (link pessoal).
 * @return {{nome:string, dono:boolean}|null}
 */
function identificarUsuario_(token) {
  if (ehDono_()) return { nome: 'Assistente', dono: true };
  if (token && typeof validarLinkPessoal_ === 'function') return validarLinkPessoal_(token);
  return null;
}

/** Nome de quem está usando (para o registro de ações). */
function quem_() {
  return ACESSO ? ACESSO.nome : 'Assistente';
}

/** Envelope das chamadas do app: confere acesso e devolve JSON (datas viram texto). */
function api_(fn) {
  try {
    if (!ACESSO) ACESSO = identificarUsuario_('');
    if (!ACESSO) throw new Error('Acesso negado.');
    return JSON.stringify({ ok: true, dados: fn() });
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    return JSON.stringify({ ok: false, erro: String(e && e.message ? e.message : e) });
  }
}

/** Formata data no fuso da planilha. */
function fmtData_(d, padrao) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, planilha_().getSpreadsheetTimeZone(), padrao || 'dd/MM/yyyy');
}

/** Lista de itens do checklist (um por linha, sem numeração). */
function itensDoPedido_(texto) {
  return String(texto || '').split(/\r?\n+/)
    .map(function (l) { return l.replace(/^\s*(\d+[.)-]|[•*-])\s*/, '').trim(); })
    .filter(String);
}

/** Lê o checklist salvo numa entrega (JSON) com segurança. */
function lerChecklist_(json) {
  try {
    const v = JSON.parse(String(json || '[]'));
    return Array.isArray(v) ? v.map(function (x) {
      return { item: String(x.item || ''), status: String(x.status || ''), evidencia: String(x.evidencia || '') };
    }) : [];
  } catch (e) { return []; }
}

/* ------------------------------------------------------------------ */
/*  DADOS PARA O APP                                                   */
/* ------------------------------------------------------------------ */

/** Tudo o que a tela inicial precisa. */
function apiInicio() {
  return api_(function () {
    const cfg = lerConfig_();
    const aulas = lerAba_(ESQUEMA.AULAS);
    const equipes = lerAba_(ESQUEMA.EQUIPES);
    const entregas = lerAba_(ESQUEMA.ENTREGAS);
    const daVez = aulaDaVez_(aulas);
    const agora = Date.now();

    const listaAulas = aulas
      .slice()
      .sort(function (a, b) { return Number(a.NUMERO) - Number(b.NUMERO); })
      .map(function (a) {
        const de = a.RECEBE_DE instanceof Date ? a.RECEBE_DE.getTime() : 0;
        const ate = a.RECEBE_ATE instanceof Date ? a.RECEBE_ATE.getTime() + 86399999 : 0;
        return {
          id: String(a.ID_AULA || ''),
          numero: a.NUMERO,
          titulo: String(a.TITULO || ''),
          dataAula: fmtData_(a.DATA_AULA),
          recebeDe: fmtData_(a.RECEBE_DE),
          recebeAte: fmtData_(a.RECEBE_ATE),
          situacao: !de || !ate ? 'sem datas' : (agora < de ? 'futura' : (agora <= ate ? 'recebendo' : 'encerrada')),
          itens: itensDoPedido_(a.ENTREGAVEIS),
          metricas: String(a.METRICAS || ''),
          observacoes: String(a.OBSERVACOES || ''),
          status: String(a.STATUS || '')
        };
      });

    const listaEntregas = entregas.map(function (e) {
      return {
        id: String(e.ID || ''),
        idAula: String(e.ID_AULA || ''),
        aula: String(e.AULA || ''),
        idEquipe: String(e.ID_EQUIPE || ''),
        equipe: String(e.EQUIPE || ''),
        pedido: String(e.PEDIDO || ''),
        remetente: String(e.REMETENTE || ''),
        enviadoEm: fmtData_(e.DATA_ENVIO, 'dd/MM HH:mm'),
        atraso: String(e.ATRASO || '').toUpperCase() === 'SIM',
        checklist: lerChecklist_(e.CHECKLIST),
        conceito: String(e.CONCEITO || '').toUpperCase(),
        evolucao: String(e.EVOLUCAO || ''),
        feedback: String(e.FEEDBACK_EQUIPE || ''),
        status: String(e.STATUS || ''),
        assunto: String(e.ASSUNTO || ''),
        aprovadoPor: String(e.APROVADO_POR || ''),
        aprovadoEm: fmtData_(e.DATA_APROVACAO, 'dd/MM HH:mm')
      };
    });

    return {
      usuario: ACESSO ? { nome: ACESSO.nome, dono: ACESSO.dono } : null,
      versao: VERSAO_APP,
      professor: cfg.NOME_PROFESSOR || '',
      aulaDaVez: daVez ? String(daVez.ID_AULA || '') : '',
      aulas: listaAulas,
      equipes: equipes.map(function (e) {
        return { id: String(e.ID_EQUIPE || ''), nome: String(e.NOME || ''), tema: String(e.TEMA || ''), emails: extrairEmails_(e.EMAILS) };
      }),
      entregas: listaEntregas
    };
  });
}

/** 📱 Menu: mostra o link do app. */
function abrirApp() {
  const url = ScriptApp.getService().getUrl();
  if (!url) {
    return alerta_('📱 App ainda não publicado',
      'No Apps Script: Implantar › Nova implantação › ⚙️ › App da Web\n' +
      '• Executar como: Eu\n• Quem pode acessar: Qualquer pessoa com Conta do Google\n\n' +
      'Para testar antes de publicar: Implantar › Testar implantações (link /dev).');
  }
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;font-size:14px">' +
    '<p><a href="' + url + '" target="_blank" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">📱 Abrir o app</a></p>' +
    '<p style="font-size:12px;color:#64748b;word-break:break-all">' + url + '</p>' +
    '<p style="font-size:12px;color:#64748b">No celular: abra este link logado na mesma conta e use "Adicionar à tela inicial".</p></div>')
    .setWidth(440).setHeight(210);
  SpreadsheetApp.getUi().showModalDialog(html, '📱 App da Consultoria');
}

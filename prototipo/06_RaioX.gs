/**
 * =====================================================================
 *  Arquivo 06_RaioX — "Raio-x da busca"
 *  Mostra TODOS os e-mails do período e o que o sistema decidiu sobre
 *  cada um, com o MOTIVO. Serve para descobrir por que um e-mail
 *  não entrou. Não altera nenhuma entrega.
 *
 *  Como usar: no Apps Script, escolha "raioXBusca" › ▷ Executar.
 *  O resultado aparece na aba "Raio-x da busca" da planilha.
 * =====================================================================
 */

function raioXBusca() {
  const ss = planilha_();
  const cfg = lerConfig_();
  const equipes = lerAba_(ESQUEMA.EQUIPES);
  const aulas = lerAba_(ESQUEMA.AULAS).filter(function (a) { return a.RECEBE_DE instanceof Date && a.RECEBE_ATE instanceof Date; });
  if (!aulas.length) return alerta_('Raio-x', 'Nenhuma aula com as duas datas preenchidas.');
  const entregas = lerAba_(ESQUEMA.ENTREGAS);
  const ctx = montarContextoBusca_(cfg, equipes, aulas, entregas);
  const statusPorEmail = {};
  entregas.forEach(function (e) { statusPorEmail[String(e.ID_EMAIL)] = e.STATUS + ' · ' + (e.EQUIPE || '?') + ' · ' + (e.AULA || '?'); });

  const msgs = lerMensagensDoGmail_(equipes, aulas, cfg, ctx.excluidos, true);
  const tz = ss.getSpreadsheetTimeZone();
  const linhas = msgs.reverse().map(function (info) {
    const r = classificarMensagem_(info, ctx);
    const decisao = r.motivo === 'já registrada' ? '✔ Já está no sistema' :
      r.acao === 'ENTREGA' ? '📥 Entraria como entrega' : r.acao === 'POSSIVEL' ? '🟡 Iria para "Para confirmar"' : '⛔ Ignorado';
    const equipeDoRem = ctx.emailParaEquipe[String(info.remetente).toLowerCase()];
    return [
      Utilities.formatDate(info.data, tz, 'dd/MM HH:mm'),
      info.remetente,
      equipeDoRem ? equipeDoRem.NOME : (ctx.excluidos.indexOf(String(info.remetente).toLowerCase()) !== -1 ? '(você/professor)' : '(não cadastrado)'),
      info.assunto,
      info.arquivos.length + ' anexo(s) · ' + info.links.length + ' link(s) Google · ' + (info.outrosLinks || []).length + ' outro(s) link(s)',
      decisao,
      r.motivo === 'já registrada' ? (statusPorEmail[String(info.id)] || '') : (r.acao === 'IGNORAR' ? r.motivo : ((r.equipe ? r.equipe.NOME : '?') + ' · ' + (r.aula ? 'Aula ' + r.aula.NUMERO : '?') + (r.avisos.length ? ' · ' + r.avisos[0] : ''))),
      false,
      String(info.id)
    ];
  });

  const nome = 'Raio-x da busca';
  const sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  sh.clear();
  const cab = ['Data', 'Remetente', 'Equipe do remetente', 'Assunto', 'Conteúdo', 'Decisão', 'Motivo / detalhe', 'Importar? ☑', 'ID do e-mail'];
  sh.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#f1f5f9');
  if (linhas.length) {
    sh.getRange(2, 1, linhas.length, cab.length).setValues(linhas).setVerticalAlignment('top');
    sh.getRange(2, 8, linhas.length, 1).insertCheckboxes();
  }
  sh.setFrozenRows(1);
  [90, 220, 170, 320, 260, 210, 420, 90, 120].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(1, 8).setNote('Marque os e-mails que deveriam ter entrado e rode "importarDoRaioX" no Apps Script.');
  sh.hideColumns(9);

  // Resumo por equipe
  const resumo = equipes.map(function (q) {
    const dela = linhas.filter(function (l) { return l[2] === q.NOME; });
    const dentro = dela.filter(function (l) { return /Já está|Entraria|Para confirmar/.test(l[5]); }).length;
    return '• ' + q.NOME + ': ' + dela.length + ' e-mail(s) no período, ' + dentro + ' entrando no sistema';
  });
  const texto = '🔎 ' + linhas.length + ' e-mail(s) analisados (do início da 1ª aula até hoje).\n\n' + resumo.join('\n') +
    '\n\nVeja a aba "' + nome + '": coluna "Decisão" e "Motivo".\nEquipe com 0 e-mails: os integrantes provavelmente usam outro e-mail (confira a aba Equipes).' +
    '\n\nE-mail que deveria ter entrado? Marque a caixa "Importar? ☑" na linha dele e rode "importarDoRaioX".';
  console.log(texto);
  alerta_('🔎 Raio-x da busca', texto);
  ss.setActiveSheet(sh);
  return texto;
}

/**
 * 🔄 Refaz a classificação do que está em "Para confirmar" com as regras atuais:
 * apaga essas linhas da aba Entregas e busca de novo. Não mexe nas entregas
 * já recebidas, analisadas ou enviadas.
 * Como usar: no Apps Script, escolha "reprocessarParaConfirmar" › ▷ Executar.
 */
function reprocessarParaConfirmar() {
  const sh = planilha_().getSheetByName(ESQUEMA.ENTREGAS.nome);
  const pend = lerAba_(ESQUEMA.ENTREGAS).filter(function (e) { return e.STATUS === ST.POSSIVEL; });
  pend.map(function (e) { return e._linha; }).sort(function (a, b) { return b - a; })
    .forEach(function (linha) { sh.deleteRow(linha); });
  registrarAcao_('Editor', 'Reprocessar "Para confirmar"', '', '', pend.length + ' item(ns) reclassificado(s)');
  const r = buscarEntregas_('Reprocessamento');
  const texto = '🔄 ' + pend.length + ' item(ns) de "Para confirmar" foram reclassificados com as regras novas.\n\n' + r.mensagem;
  console.log(texto);
  alerta_('🔄 Reprocessado', texto);
  return texto;
}

/**
 * ☑ Importa os e-mails marcados na coluna "Importar?" do Raio-x,
 * qualquer que seja a regra. Eles entram em "Para confirmar", com a equipe
 * e a aula sugeridas (se der para sugerir). No app, use "✏️ Escolher
 * aula/equipe" ou "É entrega".
 * Como usar: no Apps Script, escolha "importarDoRaioX" › ▷ Executar.
 */
function importarDoRaioX() {
  const ss = planilha_();
  const sh = ss.getSheetByName('Raio-x da busca');
  if (!sh || sh.getLastRow() < 2) return alerta_('Importar', 'Rode primeiro o raioXBusca.');
  const linhas = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
  const marcados = linhas.map(function (l, i) { return { id: String(l[8]), linha: i + 2, marcado: l[7] === true }; })
    .filter(function (x) { return x.marcado && x.id; });
  if (!marcados.length) return alerta_('Importar', 'Nenhuma linha marcada na coluna "Importar? ☑".');

  const cfg = lerConfig_();
  const equipes = lerAba_(ESQUEMA.EQUIPES);
  const aulas = lerAba_(ESQUEMA.AULAS).filter(function (a) { return a.RECEBE_DE instanceof Date && a.RECEBE_ATE instanceof Date; });
  const entregas = lerAba_(ESQUEMA.ENTREGAS);
  const ctx = montarContextoBusca_(cfg, equipes, aulas, entregas);
  let feitos = 0;
  const msgs = [];

  marcados.forEach(function (x) {
    if (ctx.registradas.has(x.id)) { msgs.push('• já estava no sistema: ' + linhas[x.linha - 2][3]); return; }
    const m = GmailApp.getMessageById(x.id);
    if (!m) { msgs.push('• e-mail não encontrado: ' + linhas[x.linha - 2][3]); return; }
    const info = resumoMensagem_(m, m.getThread());
    const r = classificarMensagem_(info, ctx);
    const rem = String(info.remetente).toLowerCase();
    const orig = String(info.encaminhadoDe || '').toLowerCase();
    const equipe = r.equipe || ctx.emailParaEquipe[rem] || ctx.emailParaEquipe[orig] || equipePorApelido_(info.assunto, equipes);
    const t = info.data.getTime();
    const aula = r.aula || aulas.find(function (a) { return a.RECEBE_DE.getTime() <= t && t <= a.RECEBE_ATE.getTime() + 86399999; }) || null;
    const reg = {
      ID: 'D' + Utilities.formatDate(info.data, 'GMT', 'yyMMddHHmmss') + '-' + info.id.slice(-4),
      ID_AULA: aula ? aula.ID_AULA : '', AULA: aula ? 'Aula ' + aula.NUMERO + ' — ' + aula.TITULO : '',
      PEDIDO: aula ? textoPedido_(aula) : '',
      ID_EQUIPE: equipe ? equipe.ID_EQUIPE : '', EQUIPE: equipe ? equipe.NOME : '',
      REMETENTE: info.remetente, DATA_ENVIO: info.data,
      ATRASO: aula && t > aula.RECEBE_ATE.getTime() + 86399999 ? 'SIM' : 'NÃO',
      ASSUNTO: info.assunto, ID_EMAIL: info.id, ID_CONVERSA: info.idConversa,
      ARQUIVOS: info.arquivos.concat(info.links.map(function (l) { return 'link: ' + l; }), (info.outrosLinks || []).map(function (l) { return 'link externo: ' + l; })).join('; '),
      AVISOS: ['Importada manualmente pelo Raio-x' + (r.acao === 'IGNORAR' ? ' (a regra tinha ignorado: ' + r.motivo + ')' : '')].concat(r.avisos || []).join(' | '),
      STATUS: ST.POSSIVEL, ATUALIZADO_EM: new Date()
    };
    inserirLinha_(ESQUEMA.ENTREGAS, reg);
    ctx.registradas.add(info.id);
    sh.getRange(x.linha, 6).setValue('🟡 Importado: confirme no app');
    sh.getRange(x.linha, 8).setValue(false);
    registrarAcao_('Editor', 'Importado pelo Raio-x', reg.AULA, reg.EQUIPE, info.assunto);
    feitos++;
  });
  const texto = '☑ ' + feitos + ' e-mail(s) importado(s) para "Para confirmar".' + (msgs.length ? '\n' + msgs.join('\n') : '') +
    '\n\nNo app: toque em ⟳ e, em "Para confirmar", use "✏️ Escolher aula/equipe" ou "É entrega".';
  console.log(texto);
  alerta_('☑ Importar do Raio-x', texto);
  return texto;
}

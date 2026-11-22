/**
 * =====================================================================
 *  CONSULTORIA DE AVALIAÇÃO DE ENTREGAS POR AULA
 *  Arquivo 01_Base — PASSO 1
 *  • Estrutura da planilha (6 abas) e preparação automática
 *  • Menu (cresce sozinho conforme os próximos arquivos forem adicionados)
 *  • Verificar instalação
 *
 *  Regra pedagógica: NENHUMA nota numérica. Só os conceitos
 *  EXCELENTE · BOM · REGULAR · RUIM, mais um checklist do que foi pedido.
 * =====================================================================
 */

/** Versão do código (aparece na verificação — confirma o que está rodando). */
const VERSAO = 'Passo 1.2 · 2026-11-18';

/** Conceitos em ordem crescente (a posição serve só para comparar evolução). */
const CONCEITOS = ['RUIM', 'REGULAR', 'BOM', 'EXCELENTE'];

/** Paleta visual (cor só em conceitos e status). */
const COR = {
  TEXTO: '#0f172a', SUAVE: '#64748b', BORDA: '#e2e8f0', CABECALHO: '#f1f5f9',
  EDITAVEL: '#fffbeb', ZEBRA: '#f8fafc'
};

/* ------------------------------------------------------------------ */
/*  ESQUEMA DAS ABAS                                                  */
/*  chave = nome usado no código | titulo = cabeçalho na planilha     */
/* ------------------------------------------------------------------ */
const ESQUEMA = {
  AULAS: {
    nome: 'Aulas', principal: 'TITULO',
    cor: '#6366f1',
    colunas: [
      { chave: 'ID_AULA', titulo: 'ID', largura: 70, nota: 'Preenchido automaticamente.' },
      { chave: 'NUMERO', titulo: 'Nº', largura: 50 },
      { chave: 'TITULO', titulo: 'Título da aula', largura: 220 },
      { chave: 'DATA_AULA', titulo: 'Data da aula', largura: 110, tipo: 'data' },
      { chave: 'RECEBE_DE', titulo: 'Recebe entregas de', largura: 140, tipo: 'data' },
      { chave: 'RECEBE_ATE', titulo: 'Recebe entregas até', largura: 140, tipo: 'data', nota: 'Data inclusiva (até 23:59). Depois disso a entrega é marcada como "com atraso".' },
      { chave: 'ENTREGAVEIS', titulo: 'O que deve ser entregue (um item por linha)', largura: 320, quebra: true, nota: 'Checklist: a IA confere item por item (Entregue / Parcial / Não entregue).' },
      { chave: 'METRICAS', titulo: 'Métricas / critérios de qualidade', largura: 320, quebra: true },
      { chave: 'OBSERVACOES', titulo: 'Observações para a IA (opcional)', largura: 240, quebra: true },
      { chave: 'STATUS', titulo: 'Status', largura: 120, lista: ['Planejada', 'Recebendo', 'Analisada', 'Concluída'] }
    ]
  },
  EQUIPES: {
    nome: 'Equipes', principal: 'NOME',
    cor: '#0ea5e9',
    colunas: [
      { chave: 'ID_EQUIPE', titulo: 'ID', largura: 60, nota: 'Preenchido automaticamente.' },
      { chave: 'NOME', titulo: 'Nome da equipe', largura: 180 },
      { chave: 'TEMA', titulo: 'Tema / projeto', largura: 240, quebra: true },
      { chave: 'EMAILS', titulo: 'E-mails dos integrantes (separados por vírgula)', largura: 420, quebra: true, nota: 'Qualquer um destes e-mails pode enviar a entrega da equipe. Todos recebem a devolutiva.' },
      { chave: 'OBS', titulo: 'Observações', largura: 220, quebra: true }
    ]
  },
  ENTREGAS: {
    nome: 'Entregas', principal: 'ID',
    cor: '#10b981',
    colunas: [
      { chave: 'ID', titulo: 'ID', largura: 110 },
      { chave: 'ID_AULA', titulo: 'ID Aula', largura: 70 },
      { chave: 'AULA', titulo: 'Aula', largura: 180 },
      { chave: 'PEDIDO', titulo: 'Pedido da aula (cópia no momento da análise)', largura: 300, nota: 'Cópia congelada do que foi pedido e das métricas. Se a aula for editada depois, o histórico continua mostrando o pedido original.' },
      { chave: 'ID_EQUIPE', titulo: 'ID Equipe', largura: 70 },
      { chave: 'EQUIPE', titulo: 'Equipe', largura: 150 },
      { chave: 'REMETENTE', titulo: 'Remetente', largura: 200 },
      { chave: 'DATA_ENVIO', titulo: 'Enviado em', largura: 130, tipo: 'datahora' },
      { chave: 'ATRASO', titulo: 'Com atraso?', largura: 90 },
      { chave: 'ASSUNTO', titulo: 'Assunto', largura: 220 },
      { chave: 'ID_EMAIL', titulo: 'ID do e-mail', largura: 140 },
      { chave: 'ID_CONVERSA', titulo: 'ID da conversa', largura: 140 },
      { chave: 'ARQUIVOS', titulo: 'Arquivos lidos', largura: 220 },
      { chave: 'AVISOS', titulo: 'Avisos de leitura', largura: 220 },
      { chave: 'CHECKLIST', titulo: 'Checklist (JSON)', largura: 260 },
      { chave: 'CONCEITO', titulo: 'Conceito', largura: 100 },
      { chave: 'JUSTIFICATIVA', titulo: 'Justificativa do conceito', largura: 260 },
      { chave: 'EVOLUCAO', titulo: 'Evolução', largura: 180 },
      { chave: 'JORNADA', titulo: 'Jornada', largura: 220 },
      { chave: 'ANALISE_PROFESSOR', titulo: 'Análise para o professor (interna)', largura: 320 },
      { chave: 'FEEDBACK_EQUIPE', titulo: 'Feedback à equipe (editável)', largura: 360 },
      { chave: 'STATUS', titulo: 'Status', largura: 170 },
      { chave: 'APROVADO_POR', titulo: 'Aprovado por', largura: 150 },
      { chave: 'DATA_APROVACAO', titulo: 'Aprovado em', largura: 130, tipo: 'datahora' },
      { chave: 'DATA_DEVOLUTIVA', titulo: 'Devolutiva enviada em', largura: 150, tipo: 'datahora' },
      { chave: 'MODELO_IA', titulo: 'Modelo de IA', largura: 140 },
      { chave: 'ATUALIZADO_EM', titulo: 'Atualizado em', largura: 130, tipo: 'datahora' }
    ]
  },
  RELATORIOS: {
    nome: 'Relatórios', principal: 'ID_AULA',
    cor: '#f59e0b',
    colunas: [
      { chave: 'ID_AULA', titulo: 'ID Aula', largura: 70 },
      { chave: 'AULA', titulo: 'Aula', largura: 180 },
      { chave: 'GERADO_EM', titulo: 'Gerado em', largura: 130, tipo: 'datahora' },
      { chave: 'RESUMO', titulo: 'Resumo geral', largura: 360 },
      { chave: 'DESTAQUES', titulo: 'Destaques', largura: 300 },
      { chave: 'ATENCAO', titulo: 'Equipes que precisam de atenção', largura: 300 },
      { chave: 'SUGESTOES', titulo: 'Sugestões para a próxima aula', largura: 300 },
      { chave: 'MODELO_IA', titulo: 'Modelo de IA', largura: 140 }
    ]
  },
  ACOES: {
    nome: 'Ações', principal: 'DATA_HORA',
    cor: '#94a3b8',
    colunas: [
      { chave: 'DATA_HORA', titulo: 'Data e hora', largura: 140, tipo: 'datahora' },
      { chave: 'PESSOA', titulo: 'Pessoa', largura: 180 },
      { chave: 'ACAO', titulo: 'Ação', largura: 220 },
      { chave: 'AULA', titulo: 'Aula', largura: 160 },
      { chave: 'EQUIPE', titulo: 'Equipe', largura: 150 },
      { chave: 'DETALHE', titulo: 'Detalhe', largura: 360 }
    ]
  },
  CONFIG: {
    nome: 'Config', principal: 'PARAMETRO',
    cor: '#64748b',
    colunas: [
      { chave: 'PARAMETRO', titulo: 'Parâmetro', largura: 230 },
      { chave: 'VALOR', titulo: 'Valor (editável)', largura: 420, quebra: true },
      { chave: 'AJUDA', titulo: 'Para que serve', largura: 420, quebra: true }
    ]
  }
};

/** Parâmetros da aba Config: [chave, valor padrão, ajuda, obrigatório?] */
const PARAMETROS = [
  ['NOME_PROFESSOR', '', 'Nome do professor, como deve aparecer para as equipes.', true],
  ['EMAIL_PROFESSOR', '', 'E-mail do professor (para cópia nas devolutivas e avisos).', false],
  ['ASSINATURA_PROFESSOR', 'Prof. Nome Sobrenome\nDisciplina', 'Assinatura no final das devolutivas. Pode ter várias linhas.', true],
  ['PROFESSOR_EM_COPIA', 'NÃO', 'SIM = o professor recebe cópia de cada devolutiva enviada.', true],
  ['AVISAR_PROFESSOR', 'SIM', 'SIM = o professor recebe um e-mail quando a análise de uma aula ficar pronta para revisão.', true],
  ['ASSUNTO_PREFIXO', '[ENTREGA]', 'Etiqueta obrigatória no assunto. Assunto padrão das equipes: [ENTREGA] Aula 3 - Nome da Equipe', true],
  ['EMAIL_ENTREGAS', '', 'Seu e-mail (assistente), para onde as equipes enviam. Aparece nas instruções para as equipes.', false],
  ['CONCEITO_EXCELENTE', 'Entregou todos os itens pedidos com profundidade, clareza e evidências; vai além do solicitado.', 'O que significa EXCELENTE (vale para todas as aulas, salvo métricas específicas da aula).', true],
  ['CONCEITO_BOM', 'Entregou os itens principais com boa qualidade; ajustes pontuais a fazer.', 'O que significa BOM.', true],
  ['CONCEITO_REGULAR', 'Entregou parcialmente; lacunas relevantes ou pouca fundamentação.', 'O que significa REGULAR.', true],
  ['CONCEITO_RUIM', 'Não entregou o essencial, entregou fora do pedido ou sem evidência do trabalho.', 'O que significa RUIM.', true],
  ['MODELO_IA', 'gemini-2.5-flash', 'Modelo principal do Gemini. Se mudar de nome no futuro, troque aqui.', true],
  ['MODELO_IA_RESERVA', 'gemini-2.0-flash', 'Modelo usado se o principal falhar.', false],
  ['PASTA_DRIVE', '', 'Opcional. Link ou ID de uma pasta do Drive para guardar os anexos recebidos.', false]
];

/* ------------------------------------------------------------------ */
/*  MENU — itens dos próximos passos aparecem sozinhos                 */
/* ------------------------------------------------------------------ */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('🎓 Consultoria');
  // "typeof" com o nome direto é seguro mesmo quando a função ainda não existe.
  if (typeof abrirApp === 'function') menu.addItem('📱 Abrir o app', 'abrirApp').addSeparator();
  if (typeof buscarEntregasMenu === 'function') menu.addItem('📥 Buscar entregas', 'buscarEntregasMenu');
  if (typeof analisarEntregasMenu === 'function') menu.addItem('🤖 Analisar entregas', 'analisarEntregasMenu');
  if (typeof enviarAprovadasMenu === 'function') menu.addItem('📨 Enviar devolutivas aprovadas', 'enviarAprovadasMenu');

  menu.addSeparator()
    .addItem('📋 Instruções para as equipes (assunto padrão)', 'instrucoesEquipes')
    .addItem('🧪 Testar um assunto de e-mail', 'testarAssunto')
    .addSeparator()
    .addItem('⚙️ Preparar planilha', 'prepararPlanilha')
    .addItem('🩺 Verificar instalação', 'verificarInstalacao');
  if (typeof configurarChaveIA === 'function') menu.addItem('🔑 Chave da IA', 'configurarChaveIA');
  menu.addToUi();
}

/* ------------------------------------------------------------------ */
/*  PREPARAR PLANILHA (pode rodar quantas vezes quiser: não apaga dados) */
/* ------------------------------------------------------------------ */
function prepararPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('PLANILHA_ID', ss.getId());

  const ordem = ['AULAS', 'EQUIPES', 'ENTREGAS', 'RELATORIOS', 'ACOES', 'CONFIG'];
  ordem.forEach(function (k) { garantirAba_(ss, ESQUEMA[k]); });

  preencherConfigPadrao_(ss);
  preencherExemplos_(ss);
  preencherIds_(ss);

  // Ordena as abas
  ordem.forEach(function (k, i) {
    ss.setActiveSheet(ss.getSheetByName(ESQUEMA[k].nome));
    ss.moveActiveSheet(i + 1);
  });
  // Remove a aba vazia padrão do Google
  ['Página1', 'Planilha1', 'Sheet1', 'Página 1'].forEach(function (n) {
    const sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
  ss.setActiveSheet(ss.getSheetByName(ESQUEMA.AULAS.nome));

  alerta_('✅ Planilha preparada',
    'As 6 abas estão prontas: Aulas, Equipes, Entregas, Relatórios, Ações e Config.\n\n' +
    'Próximos passos:\n' +
    '1. Aba Config: preencha NOME_PROFESSOR e a assinatura.\n' +
    '2. Aba Equipes: troque os exemplos pelos e-mails reais.\n' +
    '3. Aba Aulas: ajuste a aula de exemplo.\n' +
    '4. Menu 🎓 Consultoria › 🩺 Verificar instalação.');
}

/** Cria a aba (se não existir) e garante cabeçalho, larguras e formatos. Nunca apaga dados. */
function garantirAba_(ss, def) {
  const sh = ss.getSheetByName(def.nome) || ss.insertSheet(def.nome);
  const n = def.colunas.length;
  if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());
  if (sh.getMaxRows() < 100) sh.insertRowsAfter(sh.getMaxRows(), 100 - sh.getMaxRows());

  // Cabeçalho
  const cab = sh.getRange(1, 1, 1, n);
  cab.setValues([def.colunas.map(function (c) { return c.titulo; })])
    .setFontWeight('bold').setBackground(COR.CABECALHO).setFontColor('#334155')
    .setVerticalAlignment('middle').setWrap(true)
    .setBorder(true, true, true, true, true, true, COR.BORDA, SpreadsheetApp.BorderStyle.SOLID);
  sh.setRowHeight(1, 36);
  sh.setFrozenRows(1);
  sh.setTabColor(def.cor);

  const linhas = sh.getMaxRows() - 1;
  def.colunas.forEach(function (c, i) {
    const col = i + 1;
    sh.setColumnWidth(col, c.largura || 140);
    const corpo = sh.getRange(2, col, linhas, 1);
    corpo.setVerticalAlignment('top');
    corpo.setWrap(!!c.quebra);
    if (c.tipo === 'data') {
      corpo.setNumberFormat('dd/MM/yyyy').setDataValidation(
        SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false)
          .setHelpText('Informe uma data (dd/mm/aaaa).').build());
    } else if (c.tipo === 'datahora') {
      corpo.setNumberFormat('dd/MM/yyyy HH:mm');
    }
    if (c.lista) {
      corpo.setDataValidation(SpreadsheetApp.newDataValidation()
        .requireValueInList(c.lista, true).setAllowInvalid(false).build());
    }
    if (c.nota) sh.getRange(1, col).setNote(c.nota);
  });
  return sh;
}

/** Na aba Config, acrescenta só os parâmetros que ainda não existem. */
function preencherConfigPadrao_(ss) {
  const sh = ss.getSheetByName(ESQUEMA.CONFIG.nome);
  const existentes = {};
  if (sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (l) {
      existentes[String(l[0]).trim()] = true;
    });
  }
  const novos = PARAMETROS.filter(function (p) { return !existentes[p[0]]; })
    .map(function (p) { return [p[0], p[1], p[2] + (p[3] ? ' (obrigatório)' : '')]; });
  if (novos.length) sh.getRange(sh.getLastRow() + 1, 1, novos.length, 3).setValues(novos);

  const n = sh.getLastRow() - 1;
  sh.getRange(2, 1, n, 1).setFontWeight('bold').setFontFamily('Roboto Mono').setFontSize(9);
  sh.getRange(2, 2, n, 1).setBackground(COR.EDITAVEL);
  sh.getRange(2, 3, n, 1).setFontColor(COR.SUAVE).setFontStyle('italic');
}

/** Exemplos só quando a aba está vazia (para mostrar o formato esperado). */
function preencherExemplos_(ss) {
  const aulas = ss.getSheetByName(ESQUEMA.AULAS.nome);
  if (aulas.getLastRow() < 2) {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const mais = function (d) { return new Date(hoje.getTime() + d * 86400000); };
    aulas.getRange(2, 1, 1, ESQUEMA.AULAS.colunas.length).setValues([[
      '', 1, 'EXEMPLO — Definição do problema', mais(0), mais(0), mais(6),
      '1. Descrição do problema de saúde escolhido\n2. Público-alvo e contexto\n3. Pesquisa com pelo menos 3 fontes\n4. Esboço inicial da solução (desenho ou wireframe)',
      'Clareza do problema; fundamentação nas fontes; coerência entre problema e solução; integração entre design, saúde e tecnologia.',
      'Esta é a primeira entrega: valorize a clareza do problema mais do que o acabamento.',
      'Planejada'
    ]]);
  }
  const equipes = ss.getSheetByName(ESQUEMA.EQUIPES.nome);
  if (equipes.getLastRow() < 2) {
    const linhas = [];
    for (let i = 1; i <= 6; i++) {
      linhas.push(['', 'Equipe ' + i, '', 'integrante1.equipe' + i + '@exemplo.com, integrante2.equipe' + i + '@exemplo.com', 'EXEMPLO — troque pelos e-mails reais']);
    }
    equipes.getRange(2, 1, linhas.length, 5).setValues(linhas);
  }
}

/** Preenche IDs que estiverem vazios (A01, A02… / E01, E02…). */
function preencherIds_(ss) {
  [[ESQUEMA.AULAS, 'A'], [ESQUEMA.EQUIPES, 'E']].forEach(function (par) {
    const def = par[0];
    const sh = ss.getSheetByName(def.nome);
    if (!sh || sh.getLastRow() < 2) return;
    const colPrincipal = def.colunas.findIndex(function (c) { return c.chave === def.principal; });
    const dados = sh.getRange(2, 1, sh.getLastRow() - 1, colPrincipal + 1).getValues();
    const usados = {};
    dados.forEach(function (l) { if (l[0]) usados[String(l[0])] = true; });
    let n = 1;
    const ids = dados.map(function (l) {
      if (l[0] || !String(l[colPrincipal]).trim()) return [l[0]];
      let id;
      do { id = par[1] + ('0' + n).slice(-2); n++; } while (usados[id]);
      usados[id] = true;
      return [id];
    });
    sh.getRange(2, 1, ids.length, 1).setValues(ids);
  });
}

/* ------------------------------------------------------------------ */
/*  LEITURA DAS ABAS (por título de coluna — usada nos próximos passos) */
/* ------------------------------------------------------------------ */

/** Planilha do sistema (funciona pelo menu e, nos próximos passos, pelo app). */
function planilha_() {
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (ss) return ss;
  const id = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
  if (!id) throw new Error('Planilha não encontrada. Abra a planilha e rode ⚙️ Preparar planilha.');
  return SpreadsheetApp.openById(id);
}

/**
 * Lê uma aba como lista de objetos { CHAVE: valor, _linha }.
 * Ignora linhas vazias (sem a coluna principal da aba preenchida).
 */
function lerAba_(def) {
  const sh = planilha_().getSheetByName(def.nome);
  if (!sh || sh.getLastRow() < 2) return [];
  const n = def.colunas.length;
  return sh.getRange(2, 1, sh.getLastRow() - 1, n).getValues()
    .map(function (l, i) {
      const o = { _linha: i + 2 };
      def.colunas.forEach(function (c, j) { o[c.chave] = l[j]; });
      return o;
    })
    .filter(function (o) { return String(o[def.principal] === undefined || o[def.principal] === null ? '' : o[def.principal]).trim() !== ''; });
}

/** Lê a aba Config como objeto { PARAMETRO: valor }. */
function lerConfig_() {
  const cfg = {};
  PARAMETROS.forEach(function (p) { cfg[p[0]] = ''; });
  const sh = planilha_().getSheetByName(ESQUEMA.CONFIG.nome);
  if (sh && sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (l) {
      const k = String(l[0]).trim();
      if (k) cfg[k] = String(l[1] === null ? '' : l[1]).trim();
    });
  }
  return cfg;
}

/* ------------------------------------------------------------------ */
/*  VERIFICAR INSTALAÇÃO                                               */
/* ------------------------------------------------------------------ */
function verificarInstalacao() {
  const r = diagnostico_();
  const texto = r.linhas.join('\n');
  console.log(texto);
  alerta_(r.erros ? '🩺 Verificação: ' + r.erros + ' problema(s) para corrigir' :
    (r.avisos ? '🩺 Verificação: tudo certo, com ' + r.avisos + ' aviso(s)' : '🩺 Verificação: tudo certo ✅'), texto);
  return texto;
}

/** Monta o relatório de verificação. */
function diagnostico_() {
  const linhas = ['Versão do código: ' + VERSAO, ''];
  let erros = 0, avisos = 0;
  const ok = function (t) { linhas.push('✅ ' + t); };
  const aviso = function (t) { linhas.push('⚠️ ' + t); avisos++; };
  const erro = function (t) { linhas.push('❌ ' + t); erros++; };

  let ss;
  try { ss = planilha_(); } catch (e) { erro(e.message); return { linhas: linhas, erros: erros, avisos: avisos }; }

  // 1) Abas e cabeçalhos
  linhas.push('— ABAS —');
  let abasOk = true;
  Object.keys(ESQUEMA).forEach(function (k) {
    const def = ESQUEMA[k];
    const sh = ss.getSheetByName(def.nome);
    if (!sh) { erro('Aba "' + def.nome + '" não existe → rode ⚙️ Preparar planilha.'); abasOk = false; return; }
    const cab = sh.getRange(1, 1, 1, def.colunas.length).getValues()[0].map(String);
    const faltando = def.colunas.filter(function (c, i) { return cab[i] !== c.titulo; });
    if (faltando.length) {
      erro('Aba "' + def.nome + '": cabeçalho alterado (' + faltando.map(function (c) { return c.titulo; }).slice(0, 3).join('; ') +
        ') → rode ⚙️ Preparar planilha para restaurar.');
      abasOk = false;
    }
  });
  if (abasOk) ok('As 6 abas existem com os cabeçalhos corretos.');
  if (!abasOk) return { linhas: linhas, erros: erros, avisos: avisos };

  // 2) Configurações
  linhas.push('', '— CONFIG —');
  const cfg = lerConfig_();
  PARAMETROS.forEach(function (p) {
    if (p[3] && !cfg[p[0]]) erro('Config › ' + p[0] + ' está vazio.');
  });
  if (/Nome Sobrenome/.test(cfg.ASSINATURA_PROFESSOR)) aviso('Config › ASSINATURA_PROFESSOR ainda é o texto de exemplo.');
  ['PROFESSOR_EM_COPIA', 'AVISAR_PROFESSOR'].forEach(function (k) {
    if (cfg[k] && ['SIM', 'NÃO', 'NAO'].indexOf(cfg[k].toUpperCase()) === -1) erro('Config › ' + k + ' deve ser SIM ou NÃO.');
  });
  if ((sim_(cfg.PROFESSOR_EM_COPIA) || sim_(cfg.AVISAR_PROFESSOR)) && !extrairEmails_(cfg.EMAIL_PROFESSOR).length) {
    erro('Config › EMAIL_PROFESSOR é necessário porque cópia/aviso ao professor está como SIM.');
  }
  if (cfg.NOME_PROFESSOR && !erros) ok('Configurações preenchidas.');

  // 3) Equipes
  linhas.push('', '— EQUIPES —');
  const eq = verificarEquipes_(lerAba_(ESQUEMA.EQUIPES));
  eq.erros.forEach(erro); eq.avisos.forEach(aviso);
  if (eq.total) ok(eq.total + ' equipe(s) cadastrada(s), ' + eq.emails + ' e-mail(s) no total.');

  // 4) Aulas
  linhas.push('', '— AULAS —');
  const au = verificarAulas_(lerAba_(ESQUEMA.AULAS));
  au.erros.forEach(erro); au.avisos.forEach(aviso);
  if (au.total) ok(au.total + ' aula(s) cadastrada(s).');

  // 5) Ambiente
  linhas.push('', '— AMBIENTE —');
  const fuso = ss.getSpreadsheetTimeZone();
  if (/Sao_Paulo|Fortaleza|Recife|Bahia|Belem|Manaus|Cuiaba|Campo_Grande|Porto_Velho|Boa_Vista|Rio_Branco|Araguaina|Maceio|Noronha|Santarem/.test(fuso)) {
    ok('Fuso horário da planilha: ' + fuso + '.');
  } else {
    aviso('Fuso horário da planilha é "' + fuso + '". Ajuste em Arquivo › Configurações › Fuso horário (ex.: São Paulo).');
  }
  if (PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')) ok('Chave da IA configurada.');
  else linhas.push('ℹ️ Chave da IA: será configurada no Passo 4.');

  linhas.push('', erros ? '➡️ Corrija os itens ❌ e rode a verificação de novo.' : '➡️ Tudo pronto para o próximo passo.');
  return { linhas: linhas, erros: erros, avisos: avisos };
}

/** Regras das equipes (separada para poder ser testada). */
function verificarEquipes_(equipes) {
  const erros = [], avisos = [];
  const dono = {};
  let emails = 0;
  if (!equipes.length) erros.push('Nenhuma equipe cadastrada na aba Equipes.');
  equipes.forEach(function (e) {
    const nome = String(e.NOME).trim();
    const lista = extrairEmails_(e.EMAILS);
    emails += lista.length;
    if (!lista.length) erros.push('Equipe "' + nome + '" (linha ' + e._linha + ') sem e-mail válido.');
    if (lista.some(function (x) { return /@exemplo\.com$/.test(x); })) avisos.push('Equipe "' + nome + '" ainda tem e-mails de exemplo.');
    else if (lista.length && lista.length !== 5) avisos.push('Equipe "' + nome + '" tem ' + lista.length + ' e-mail(s) (o esperado são 5 integrantes).');
    lista.forEach(function (x) {
      if (dono[x] && dono[x] !== nome) erros.push('O e-mail ' + x + ' está em duas equipes ("' + dono[x] + '" e "' + nome + '").');
      dono[x] = nome;
    });
  });
  const nomes = equipes.map(function (e) { return normalizar_(e.NOME); });
  nomes.forEach(function (n, i) {
    if (/\baula\b/.test(n)) avisos.push('O nome da equipe "' + equipes[i].NOME + '" contém a palavra "aula", o que pode confundir a leitura do assunto.');
  });
  nomes.forEach(function (n, i) { if (nomes.indexOf(n) !== i) erros.push('Nome de equipe repetido: "' + equipes[i].NOME + '".'); });
  return { erros: erros, avisos: avisos, total: equipes.length, emails: emails };
}

/** Regras das aulas (separada para poder ser testada). */
function verificarAulas_(aulas) {
  const erros = [], avisos = [];
  if (!aulas.length) erros.push('Nenhuma aula cadastrada na aba Aulas.');
  const validas = [];
  aulas.forEach(function (a) {
    const rot = 'Aula "' + a.TITULO + '" (linha ' + a._linha + ')';
    if (!a.ID_AULA) avisos.push(rot + ' sem ID → rode ⚙️ Preparar planilha para gerar.');
    const de = a.RECEBE_DE instanceof Date ? a.RECEBE_DE : null;
    const ate = a.RECEBE_ATE instanceof Date ? a.RECEBE_ATE : null;
    if (!de || !ate) erros.push(rot + ': preencha "Recebe entregas de" e "Recebe entregas até".');
    else if (de > ate) erros.push(rot + ': "Recebe de" é depois de "Recebe até".');
    else validas.push({ rot: rot, de: de.getTime(), ate: ate.getTime() + 86399999 });
    if (!String(a.ENTREGAVEIS).trim()) erros.push(rot + ': preencha "O que deve ser entregue".');
    if (!String(a.METRICAS).trim()) avisos.push(rot + ': sem métricas (a IA usará só a definição geral dos conceitos).');
    if (/^EXEMPLO/i.test(String(a.TITULO))) avisos.push(rot + ' ainda é o exemplo: ajuste para a aula real.');
  });
  // Janelas sobrepostas
  for (let i = 0; i < validas.length; i++) {
    for (let j = i + 1; j < validas.length; j++) {
      if (validas[i].de <= validas[j].ate && validas[j].de <= validas[i].ate) {
        avisos.push(validas[i].rot + ' e ' + validas[j].rot + ' têm períodos sobrepostos: as equipes deverão citar a aula no assunto (ex.: "Aula 2").');
      }
    }
  }
  return { erros: erros, avisos: avisos, total: aulas.length };
}

/* ------------------------------------------------------------------ */
/*  ASSUNTO PADRÃO:  [ENTREGA] Aula 3 - Nome da Equipe                  */
/* ------------------------------------------------------------------ */

/** Monta o assunto padrão de uma equipe para uma aula. */
function assuntoPadrao_(prefixo, numeroAula, nomeEquipe) {
  return (String(prefixo || '').trim() + ' Aula ' + numeroAula + ' - ' + String(nomeEquipe).trim()).trim();
}

/** Texto simplificado para comparar (sem acento, minúsculo, pontuação vira espaço). */
function simplificar_(t) {
  return ' ' + normalizar_(t).replace(/[^a-z0-9º°]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
}

/**
 * Interpreta o assunto de um e-mail.
 * Aceita variações: maiúsculas/minúsculas, acentos, "Aula 03", "Aula nº 3",
 * "RE:"/"ENC:" na frente, traço ou dois-pontos como separador.
 * @return {{temPrefixo:boolean, numeroAula:(number|null), aula:Object|null,
 *           equipe:Object|null, avisos:string[]}}
 */
function interpretarAssunto_(assunto, prefixo, equipes, aulas) {
  const avisos = [];
  const simp = simplificar_(assunto);

  // 1) Etiqueta: precisa estar NO COMEÇO do assunto (depois de RE:/ENC:/FW:).
  //    Assim "Dúvida sobre a entrega da aula 2" NÃO é confundido com entrega.
  const pre = simplificar_(prefixo).trim();
  const inicio = simp.replace(/^ ((re|res|enc|fw|fwd|tr) )+/, ' ');
  const temPrefixo = !pre || inicio.indexOf(' ' + pre + ' ') === 0;
  if (!temPrefixo) avisos.push('O assunto não começa com a etiqueta "' + prefixo + '": não é tratado como entrega.');

  // 2) Número da aula
  const m = simp.match(/ aula ?(?:n[º°o]? ?)?0*(\d{1,3}) /);
  const numeroAula = m ? Number(m[1]) : null;
  let aula = null;
  if (numeroAula === null) avisos.push('Número da aula não encontrado no assunto (o sistema usará a data do envio).');
  else {
    aula = (aulas || []).find(function (a) { return Number(a.NUMERO) === numeroAula; }) || null;
    if (!aula) avisos.push('Não existe "Aula ' + numeroAula + '" cadastrada na aba Aulas.');
  }

  // 3) Equipe (nome mais longo que aparecer inteiro no assunto)
  let equipe = null, tamanho = 0;
  (equipes || []).forEach(function (e) {
    const n = simplificar_(e.NOME).trim();
    if (n && simp.indexOf(' ' + n + ' ') !== -1 && n.length > tamanho) { equipe = e; tamanho = n.length; }
  });
  if (!equipe) avisos.push('Nome da equipe não reconhecido no assunto (o sistema usará o e-mail do remetente).');

  return { temPrefixo: temPrefixo, numeroAula: numeroAula, aula: aula, equipe: equipe, avisos: avisos };
}

/** Aula "da vez": a que está recebendo hoje; senão a próxima; senão a última. */
function aulaDaVez_(aulas) {
  const hoje = Date.now();
  const comData = aulas.filter(function (a) { return a.RECEBE_DE instanceof Date && a.RECEBE_ATE instanceof Date; });
  const atual = comData.find(function (a) { return a.RECEBE_DE.getTime() <= hoje && hoje <= a.RECEBE_ATE.getTime() + 86399999; });
  if (atual) return atual;
  const futuras = comData.filter(function (a) { return a.RECEBE_DE.getTime() > hoje; })
    .sort(function (a, b) { return a.RECEBE_DE - b.RECEBE_DE; });
  if (futuras.length) return futuras[0];
  return aulas[aulas.length - 1] || null;
}

/** 📋 Gera o texto pronto para enviar às equipes, com o assunto de cada uma. */
function instrucoesEquipes() {
  const ui = SpreadsheetApp.getUi();
  const cfg = lerConfig_();
  const equipes = lerAba_(ESQUEMA.EQUIPES);
  const aulas = lerAba_(ESQUEMA.AULAS);
  if (!equipes.length || !aulas.length) return alerta_('Faltam dados', 'Cadastre as equipes e pelo menos uma aula.');

  const sugestao = aulaDaVez_(aulas);
  const resp = ui.prompt('📋 Instruções para as equipes',
    'Número da aula (sugestão: ' + (sugestao ? sugestao.NUMERO : '1') + '). Deixe vazio para usar a sugestão:',
    ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const num = Number(resp.getResponseText().trim() || (sugestao ? sugestao.NUMERO : 1));
  const aula = aulas.find(function (a) { return Number(a.NUMERO) === num; });
  if (!aula) return alerta_('Aula não encontrada', 'Não existe aula com Nº ' + num + ' na aba Aulas.');

  const fmt = function (d) { return d instanceof Date ? Utilities.formatDate(d, planilha_().getSpreadsheetTimeZone(), 'dd/MM/yyyy') : '—'; };
  const destino = extrairEmails_(cfg.EMAIL_ENTREGAS)[0] || Session.getEffectiveUser().getEmail();
  const itens = String(aula.ENTREGAVEIS || '').split(/\n+/).map(function (l) { return l.trim(); }).filter(String);

  const texto = [
    'Olá, equipes!',
    '',
    'Entrega da Aula ' + aula.NUMERO + ' — ' + aula.TITULO,
    'Prazo: até ' + fmt(aula.RECEBE_ATE) + ' (23:59).',
    '',
    'O que entregar:',
    itens.map(function (i) { return '• ' + i.replace(/^\d+[.)-]\s*/, ''); }).join('\n'),
    '',
    'Como enviar:',
    '• Para: ' + destino,
    '• Qualquer integrante pode enviar, a partir do e-mail cadastrado.',
    '• Anexe os arquivos (PDF, imagens etc.) ou cole os links do Google Docs/Slides no corpo do e-mail.',
    '• Use EXATAMENTE o assunto da sua equipe:',
    '',
    equipes.map(function (e) { return '   ' + e.NOME + ':  ' + assuntoPadrao_(cfg.ASSUNTO_PREFIXO, aula.NUMERO, e.NOME); }).join('\n'),
    '',
    'Se precisar reenviar, use o mesmo assunto: vale o último envio dentro do prazo.',
    '',
    String(cfg.ASSINATURA_PROFESSOR || '')
  ].join('\n');

  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;font-size:13px">' +
    '<p style="margin:0 0 8px">Copie e envie para as equipes (e-mail, WhatsApp, Classroom…):</p>' +
    '<textarea id="t" style="width:100%;height:330px;font-family:monospace;font-size:12px">' +
    texto.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</textarea>' +
    '<p><button onclick="var t=document.getElementById(\'t\');t.select();document.execCommand(\'copy\');this.textContent=\'Copiado ✓\'" ' +
    'style="padding:8px 14px;font-weight:bold">Copiar texto</button></p></div>')
    .setWidth(640).setHeight(450);
  ui.showModalDialog(html, '📋 Instruções — Aula ' + aula.NUMERO);
}

/** 🧪 Mostra como o sistema vai interpretar um assunto. */
function testarAssunto() {
  const ui = SpreadsheetApp.getUi();
  const cfg = lerConfig_();
  const equipes = lerAba_(ESQUEMA.EQUIPES);
  const aulas = lerAba_(ESQUEMA.AULAS);
  const exemplo = equipes.length ? assuntoPadrao_(cfg.ASSUNTO_PREFIXO, 1, equipes[0].NOME) : '[ENTREGA] Aula 1 - Equipe';
  const resp = ui.prompt('🧪 Testar um assunto', 'Cole o assunto de um e-mail (ex.: ' + exemplo + '):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const r = interpretarAssunto_(resp.getResponseText(), cfg.ASSUNTO_PREFIXO, equipes, aulas);
  alerta_('🧪 Resultado',
    (r.temPrefixo ? '✅' : '❌') + ' Etiqueta "' + cfg.ASSUNTO_PREFIXO + '"\n' +
    (r.aula ? '✅ Aula: ' + r.aula.NUMERO + ' — ' + r.aula.TITULO : (r.numeroAula ? '❌ Aula ' + r.numeroAula + ' não cadastrada' : '⚠️ Aula: não informada')) + '\n' +
    (r.equipe ? '✅ Equipe: ' + r.equipe.NOME : '⚠️ Equipe: não reconhecida pelo assunto') +
    (r.avisos.length ? '\n\nObservações:\n• ' + r.avisos.join('\n• ') : '') +
    '\n\nLembrete: a equipe também é reconhecida pelo e-mail de quem envia. O assunto é a confirmação.');
}

/* ------------------------------------------------------------------ */
/*  UTILITÁRIOS                                                        */
/* ------------------------------------------------------------------ */
function extrairEmails_(texto) {
  const achados = String(texto || '').match(/[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const unicos = [];
  achados.forEach(function (e) { const n = e.toLowerCase(); if (unicos.indexOf(n) === -1) unicos.push(n); });
  return unicos;
}

function normalizar_(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function sim_(v) {
  return String(v || '').trim().toUpperCase() === 'SIM';
}

function alerta_(titulo, mensagem) {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert(titulo, mensagem, ui.ButtonSet.OK);
  } catch (e) {
    console.log(titulo + '\n' + mensagem); // quando roda pelo editor ou pelo app
  }
}

/**
 * =====================================================================
 *  Arquivo 09_Relatorio — PASSO 7
 *  Relatório da aula para o professor (visão da turma inteira):
 *   • números calculados pelo sistema: quem entregou, conceitos,
 *     atrasos, itens do pedido que mais faltaram
 *   • leitura da IA: resumo, destaques, equipes que precisam de
 *     atenção, padrões comuns e sugestões para a próxima aula
 *   • fica salvo na aba "Relatórios" e pode ser enviado ao professor
 *  Sem notas numéricas: só contagens e conceitos.
 * =====================================================================
 */

const VERSAO_RELATORIO = 'Passo 7 · 2026-11-20';

/**
 * Dados do relatório de uma aula (números ao vivo + último texto da IA).
 * acao = 'enviar' → envia o relatório por e-mail ao professor (só o assistente).
 */
function apiRelatorioAula(idAula, acao) {
  return api_(function () {
    const dados = montarRelatorio_(idAula);
    if (acao === 'enviar') {
      if (!ACESSO || !ACESSO.dono) throw new Error('Só o assistente envia o relatório por e-mail.');
      enviarRelatorioPorEmail_(dados);
      dados.enviado = true;
    }
    return dados;
  });
}

/** 🤖 Gera (ou atualiza) o texto do relatório com a IA. */
function apiGerarRelatorio(idAula) {
  return api_(function () {
    return comTrava_(function () {
      const base = montarRelatorio_(idAula);
      if (!base.analisadas.length) throw new Error('Nenhuma entrega analisada nesta aula ainda. Toque em 🤖 Analisar primeiro.');
      const r = chamarGemini_(instrucaoRelatorio_(), [{ text: textoParaRelatorio_(base) }], esquemaRelatorio_(), false);
      const res = r.resultado || {};
      const lista = function (arr) { return (Array.isArray(arr) ? arr : []).map(function (x) { return '• ' + String(x).trim(); }).join('\n'); };
      const atencao = (Array.isArray(res.equipes_atencao) ? res.equipes_atencao : [])
        .map(function (x) { return '• ' + String(x.equipe || '').trim() + ': ' + String(x.motivo || '').trim(); }).join('\n');
      const reg = {
        ID_AULA: base.aula.id,
        AULA: 'Aula ' + base.aula.numero + ' — ' + base.aula.titulo,
        GERADO_EM: new Date(),
        RESUMO: String(res.resumo_geral || '').trim() + (res.padroes_comuns && res.padroes_comuns.length ? '\n\nPadrões comuns:\n' + lista(res.padroes_comuns) : ''),
        DESTAQUES: lista(res.destaques),
        ATENCAO: atencao,
        SUGESTOES: lista(res.sugestoes_proxima_aula),
        MODELO_IA: r.modelo
      };
      salvarRelatorio_(reg);
      registrarAcao_(quem_(), 'Relatório da aula gerado', reg.AULA, '', base.analisadas.length + ' equipe(s) analisada(s)');
      return montarRelatorio_(idAula);
    });
  });
}

/* ------------------------------------------------------------------ */
/*  NÚMEROS DA AULA (calculados pelo sistema)                          */
/* ------------------------------------------------------------------ */

function montarRelatorio_(idAula) {
  const aula = lerAba_(ESQUEMA.AULAS).find(function (a) { return String(a.ID_AULA) === String(idAula); });
  if (!aula) throw new Error('Aula não encontrada.');
  const equipes = lerAba_(ESQUEMA.EQUIPES);
  const ativas = lerAba_(ESQUEMA.ENTREGAS).filter(function (e) {
    return String(e.ID_AULA) === String(idAula) && !/substitu|ignorad|poss[ií]vel/i.test(String(e.STATUS));
  });
  // Última entrega ativa de cada equipe
  const porEquipe = {};
  ativas.forEach(function (e) {
    const atual = porEquipe[e.ID_EQUIPE];
    if (!atual || (e.DATA_ENVIO || 0) >= (atual.DATA_ENVIO || 0)) porEquipe[e.ID_EQUIPE] = e;
  });
  const entregues = Object.keys(porEquipe).map(function (k) { return porEquipe[k]; });
  const analisadas = entregues.filter(function (e) { return CONCEITOS.indexOf(String(e.CONCEITO)) !== -1; });

  const conceitos = { EXCELENTE: 0, BOM: 0, REGULAR: 0, RUIM: 0 };
  analisadas.forEach(function (e) { conceitos[e.CONCEITO]++; });

  // Itens do pedido que mais faltaram (não entregue ou parcial)
  const faltas = {};
  analisadas.forEach(function (e) {
    lerChecklist_(e.CHECKLIST).forEach(function (c) {
      if (c.status === 'ENTREGUE') return;
      const f = faltas[c.item] = faltas[c.item] || { item: c.item, nao: 0, parcial: 0, equipes: [] };
      if (c.status === 'NAO_ENTREGUE') f.nao++; else f.parcial++;
      f.equipes.push(String(e.EQUIPE));
    });
  });
  const itensFaltando = Object.keys(faltas).map(function (k) { return faltas[k]; })
    .sort(function (a, b) { return (b.nao * 2 + b.parcial) - (a.nao * 2 + a.parcial); });

  const semEntrega = equipes.filter(function (q) { return !porEquipe[q.ID_EQUIPE]; }).map(function (q) { return String(q.NOME); });
  const rel = lerAba_(ESQUEMA.RELATORIOS).filter(function (r) { return String(r.ID_AULA) === String(idAula); }).pop();

  return {
    aula: { id: String(aula.ID_AULA), numero: aula.NUMERO, titulo: String(aula.TITULO || ''), metricas: String(aula.METRICAS || ''), itens: itensDoPedido_(aula.ENTREGAVEIS) },
    totalEquipes: equipes.length,
    entregaram: entregues.length,
    semEntrega: semEntrega,
    atrasadas: entregues.filter(function (e) { return String(e.ATRASO).toUpperCase() === 'SIM'; }).map(function (e) { return String(e.EQUIPE); }),
    conceitos: conceitos,
    porConceito: analisadas.map(function (e) { return { equipe: String(e.EQUIPE), conceito: String(e.CONCEITO), evolucao: String(e.EVOLUCAO || '') }; }),
    itensFaltando: itensFaltando,
    aguardandoAnalise: entregues.length - analisadas.length,
    analisadas: analisadas.map(function (e) {
      return { equipe: String(e.EQUIPE), conceito: String(e.CONCEITO), evolucao: String(e.EVOLUCAO || ''), atraso: String(e.ATRASO).toUpperCase() === 'SIM',
        justificativa: String(e.JUSTIFICATIVA || ''), analise: String(e.ANALISE_PROFESSOR || ''), checklist: lerChecklist_(e.CHECKLIST) };
    }),
    relatorio: rel ? {
      geradoEm: fmtData_(rel.GERADO_EM, 'dd/MM HH:mm'), resumo: String(rel.RESUMO || ''), destaques: String(rel.DESTAQUES || ''),
      atencao: String(rel.ATENCAO || ''), sugestoes: String(rel.SUGESTOES || ''), modelo: String(rel.MODELO_IA || '')
    } : null
  };
}

/* ------------------------------------------------------------------ */
/*  IA                                                                 */
/* ------------------------------------------------------------------ */

function esquemaRelatorio_() {
  return {
    type: 'OBJECT',
    properties: {
      resumo_geral: { type: 'STRING' },
      destaques: { type: 'ARRAY', items: { type: 'STRING' } },
      equipes_atencao: { type: 'ARRAY', items: { type: 'OBJECT', properties: { equipe: { type: 'STRING' }, motivo: { type: 'STRING' } }, required: ['equipe', 'motivo'] } },
      padroes_comuns: { type: 'ARRAY', items: { type: 'STRING' } },
      sugestoes_proxima_aula: { type: 'ARRAY', items: { type: 'STRING' } }
    },
    required: ['resumo_geral', 'destaques', 'equipes_atencao', 'padroes_comuns', 'sugestoes_proxima_aula']
  };
}

function instrucaoRelatorio_() {
  return [
    'Você apoia um professor numa disciplina de projetos com equipes multidisciplinares (design, saúde e tecnologia).',
    'Escreva um RELATÓRIO DA AULA para o professor, comparando as equipes, com base SOMENTE nos dados fornecidos.',
    'Regras: nunca use notas, pontuações ou porcentagens (contagens simples como "2 equipes" são permitidas);',
    'não invente fatos; seja direto e útil para a próxima aula; português do Brasil.',
    'Campos:',
    '• resumo_geral: 3 a 5 frases sobre como a turma foi nesta aula.',
    '• destaques: 2 a 4 itens (o que a turma fez bem; equipes que se destacaram e por quê).',
    '• equipes_atencao: equipes que precisam de acompanhamento, com o motivo concreto (inclua quem não entregou). Lista vazia se nenhuma.',
    '• padroes_comuns: 2 a 4 padrões que se repetem entre as equipes (acertos ou lacunas).',
    '• sugestoes_proxima_aula: 2 a 4 sugestões práticas para o professor (o que reforçar, retomar ou cobrar).'
  ].join('\n');
}

function textoParaRelatorio_(b) {
  const linhas = [
    'AULA ' + b.aula.numero + ': ' + b.aula.titulo,
    'PEDIDO: ' + b.aula.itens.join('; '),
    b.aula.metricas ? 'MÉTRICAS: ' + b.aula.metricas : '',
    'ENTREGARAM: ' + b.entregaram + ' de ' + b.totalEquipes + ' equipes.',
    b.semEntrega.length ? 'NÃO ENTREGARAM: ' + b.semEntrega.join('; ') : '',
    b.atrasadas.length ? 'COM ATRASO: ' + b.atrasadas.join('; ') : '',
    'CONCEITOS: ' + Object.keys(b.conceitos).map(function (k) { return k + ' ' + b.conceitos[k]; }).join(', '),
    b.itensFaltando.length ? 'ITENS QUE MAIS FALTARAM: ' + b.itensFaltando.map(function (f) { return f.item + ' (não entregue em ' + f.nao + ', parcial em ' + f.parcial + ')'; }).join('; ') : '',
    '',
    'ANÁLISE DE CADA EQUIPE:'
  ];
  b.analisadas.forEach(function (e) {
    linhas.push('--- ' + e.equipe + ' · ' + e.conceito + (e.evolucao ? ' · ' + e.evolucao : '') + (e.atraso ? ' · com atraso' : ''));
    linhas.push('Checklist: ' + e.checklist.map(function (c) { return c.item + ' = ' + c.status; }).join('; '));
    if (e.justificativa) linhas.push('Justificativa: ' + e.justificativa.slice(0, 600));
    if (e.analise) linhas.push('Análise: ' + e.analise.slice(0, 1200));
  });
  return linhas.filter(function (l) { return l !== null; }).join('\n');
}

/* ------------------------------------------------------------------ */
/*  GRAVAR E ENVIAR                                                    */
/* ------------------------------------------------------------------ */

/** Grava (ou substitui) o relatório da aula na aba Relatórios. */
function salvarRelatorio_(reg) {
  const def = ESQUEMA.RELATORIOS;
  const sh = planilha_().getSheetByName(def.nome);
  const valores = def.colunas.map(function (c) { return reg[c.chave] === undefined ? '' : reg[c.chave]; });
  const existente = lerAba_(def).find(function (r) { return String(r.ID_AULA) === String(reg.ID_AULA); });
  if (existente) sh.getRange(existente._linha, 1, 1, valores.length).setValues([valores]);
  else sh.appendRow(valores);
}

function enviarRelatorioPorEmail_(d) {
  const cfg = lerConfig_();
  const para = extrairEmails_(cfg.EMAIL_PROFESSOR)[0];
  if (!para) throw new Error('Preencha EMAIL_PROFESSOR na aba Config.');
  const esc = escaparTexto_;
  const bloco = function (titulo, texto) {
    return texto ? '<h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin:18px 0 6px">' + titulo + '</h3>' +
      '<div style="font-size:14px;line-height:1.6;color:#1e293b">' + esc(texto).replace(/\n/g, '<br>') + '</div>' : '';
  };
  const conceitos = Object.keys(d.conceitos).map(function (k) { return k + ': ' + d.conceitos[k]; }).join(' · ');
  const faltas = d.itensFaltando.map(function (f) { return f.item + ' — faltou em ' + f.nao + ', parcial em ' + f.parcial; }).join('\n');
  const link = PropertiesService.getScriptProperties().getProperty('LINK_PROFESSOR');
  const titulo = 'Aula ' + d.aula.numero + ' — ' + d.aula.titulo;
  const r = d.relatorio || {};
  const html = '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">' +
    '<h2 style="margin:0 0 4px">📊 Relatório da ' + esc(titulo) + '</h2>' +
    '<p style="color:#475569;margin:0 0 12px">Entregaram: <b>' + d.entregaram + ' de ' + d.totalEquipes + '</b> · ' + esc(conceitos) +
    (d.atrasadas.length ? ' · com atraso: ' + d.atrasadas.length : '') + '</p>' +
    bloco('Resumo', r.resumo) + bloco('Destaques', r.destaques) + bloco('Precisam de atenção', r.atencao) +
    bloco('Itens que mais faltaram', faltas) + bloco('Não entregaram', d.semEntrega.join('\n')) +
    bloco('Sugestões para a próxima aula', r.sugestoes) +
    (link ? '<p style="margin-top:20px"><a href="' + link + '" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">Abrir o app</a></p>' : '') +
    '</div>';
  MailApp.sendEmail({ to: para, subject: '📊 Relatório da ' + titulo, htmlBody: html, body: 'Relatório da ' + titulo + '\n\n' + (r.resumo || '') });
  registrarAcao_(quem_(), 'Relatório enviado ao professor', titulo, '', para);
}

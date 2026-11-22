/**
 * =====================================================================
 *  Arquivo 04b_Diagnostico — ferramenta de diagnóstico da IA
 *  Rode a função "diagnosticoIA" pelo editor do Apps Script (▷ Executar).
 *  O resultado aparece no "Registro de execução" (parte de baixo do editor)
 *  e também numa janela na planilha, se ela estiver aberta.
 *  Não altera nenhum dado.
 * =====================================================================
 */

function diagnosticoIA() {
  const inicio = Date.now();
  const linhas = ['🧪 DIAGNÓSTICO DA IA — ' + new Date().toLocaleString('pt-BR'), ''];
  const chave = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!chave) { linhas.push('❌ Chave do Gemini não configurada.'); return mostrarDiagnostico_(linhas); }
  linhas.push('✅ Chave configurada (termina em …' + chave.slice(-4) + ').');

  // 1) Velocidade de cada modelo com uma pergunta mínima
  const cfg = lerConfig_();
  const sugerido = PropertiesService.getScriptProperties().getProperty('MODELO_IA_SUGERIDO');
  const modelos = [cfg.MODELO_IA, sugerido, cfg.MODELO_IA_RESERVA, 'gemini-flash-latest', 'gemini-flash-lite-latest']
    .map(function (m) { return String(m || '').trim(); })
    .filter(function (m, i, a) { return m && a.indexOf(m) === i; });

  linhas.push('', '— VELOCIDADE DOS MODELOS (pergunta mínima) —');
  const resultados = [];
  modelos.forEach(function (m) {
    if (Date.now() - inicio > 150000) { linhas.push('⏭️ ' + m + ': pulado (tempo do diagnóstico)'); return; }
    const gen = { responseMimeType: 'application/json',
      responseSchema: { type: 'OBJECT', properties: { ok: { type: 'STRING' } }, required: ['ok'] } };
    if (/^gemini-3/.test(m)) gen.thinkingConfig = { thinkingLevel: 'low' };
    const t0 = Date.now();
    let txt;
    try {
      const resp = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + m + ':generateContent', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { 'x-goog-api-key': chave },
        payload: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Responda {"ok":"sim"}' }] }], generationConfig: gen })
      });
      const seg = Math.round((Date.now() - t0) / 100) / 10;
      const cod = resp.getResponseCode();
      if (cod === 200) {
        txt = '✅ ' + m + ': respondeu em ' + seg + ' s';
        resultados.push({ m: m, seg: seg });
      } else {
        let det = resp.getContentText().slice(0, 120);
        try { det = JSON.parse(resp.getContentText()).error.message.slice(0, 120); } catch (e) { /* mantém */ }
        txt = '❌ ' + m + ': HTTP ' + cod + ' em ' + seg + ' s — ' + det;
      }
    } catch (e) {
      txt = '❌ ' + m + ': ' + String(e.message).slice(0, 80) + ' (após ' + Math.round((Date.now() - t0) / 1000) + ' s)';
    }
    linhas.push(txt);
  });

  // 2) Tamanho das entregas esperando análise
  linhas.push('', '— ENTREGAS ESPERANDO ANÁLISE —');
  const pend = lerAba_(ESQUEMA.ENTREGAS).filter(function (e) { return e.STATUS === ST.RECEBIDA; });
  if (!pend.length) linhas.push('Nenhuma.');
  pend.slice(0, 8).forEach(function (e) {
    try {
      const msg = GmailApp.getMessageById(String(e.ID_EMAIL));
      const anexos = msg.getAttachments({ includeInlineImages: false, includeAttachments: true });
      const total = anexos.reduce(function (s, a) { return s + a.getSize(); }, 0);
      const links = linksGoogle_((msg.getPlainBody() || '') + (msg.getBody() || '')).length;
      linhas.push('• ' + e.EQUIPE + ': ' + anexos.length + ' anexo(s), ' + (Math.round(total / 104857.6) / 10) + ' MB, ' + links + ' link(s)' +
        (anexos.length ? '\n    ' + anexos.map(function (a) { return a.getName() + ' (' + (Math.round(a.getSize() / 104857.6) / 10) + ' MB)'; }).join(', ') : ''));
    } catch (err) {
      linhas.push('• ' + e.EQUIPE + ': não consegui abrir o e-mail (' + err.message + ')');
    }
  });

  // 3) Recomendação
  linhas.push('', '— RECOMENDAÇÃO —');
  if (!resultados.length) {
    linhas.push('Nenhum modelo respondeu. O Gemini pode estar instável agora ou a chave sem cota. Tente de novo em 15 minutos.');
  } else {
    resultados.sort(function (a, b) { return a.seg - b.seg; });
    const melhor = resultados[0];
    linhas.push('Modelo mais rápido agora: ' + melhor.m + ' (' + melhor.seg + ' s).');
    if (melhor.m !== cfg.MODELO_IA) linhas.push('➡️ Na aba Config, coloque MODELO_IA = ' + melhor.m);
    if (melhor.seg > 15) linhas.push('⚠️ Mesmo a pergunta mínima está lenta: o Gemini está sobrecarregado. Tente em outro horário.');
  }
  linhas.push('', '(Diagnóstico levou ' + Math.round((Date.now() - inicio) / 1000) + ' s. Copie este texto e envie para quem está te ajudando.)');
  return mostrarDiagnostico_(linhas);
}

function mostrarDiagnostico_(linhas) {
  const texto = linhas.join('\n');
  console.log(texto);
  alerta_('🧪 Diagnóstico da IA', texto);
  return texto;
}

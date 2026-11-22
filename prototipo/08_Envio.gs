/**
 * =====================================================================
 *  Arquivo 08_Envio — PASSO 6
 *  Envia as devolutivas APROVADAS às equipes:
 *   • responde na MESMA CONVERSA em que a equipe enviou a entrega
 *   • integrantes em cópia (e o professor, se PROFESSOR_EM_COPIA = SIM)
 *   • e-mail em HTML: equipe, aula, conceito, checklist, evolução,
 *     feedback e assinatura do professor (a análise interna NUNCA vai)
 *   • confirmação antes; depois de enviada, fica bloqueada (🔒)
 *  Só o assistente envia (os e-mails saem da conta dele).
 * =====================================================================
 */

const VERSAO_ENVIO = 'Passo 6 · 2026-11-19';
const COR_CONCEITO = {
  EXCELENTE: ['#dcfce7', '#166534'], BOM: ['#dbeafe', '#1e40af'],
  REGULAR: ['#fef3c7', '#92400e'], RUIM: ['#fee2e2', '#991b1b']
};
const ROTULO_ITEM = { ENTREGUE: '✅ Entregue', PARCIAL: '🟡 Parcial', NAO_ENTREGUE: '❌ Não entregue' };

/* ------------------------------------------------------------------ */
/*  APIs DO APP                                                        */
/* ------------------------------------------------------------------ */

/** Lista o que está aprovado e pronto para enviar (com os destinatários). */
function apiFilaEnvio() {
  return api_(function () {
    exigirAssistente_();
    garantirParametrosEnvio_();
    const ctx = contextoEnvio_();
    return ctx.entregas.filter(function (e) { return e.STATUS === ST_APROVADA; }).map(function (e) {
      const d = destinatarios_(e, ctx);
      return {
        id: String(e.ID), equipe: String(e.EQUIPE), aula: String(e.AULA), conceito: String(e.CONCEITO),
        para: d.para, cc: d.cc, naConversa: d.naConversa, aprovadoPor: String(e.APROVADO_POR || '')
      };
    });
  });
}

/** 📨 Envia as devolutivas aprovadas (só os IDs confirmados na tela). */
function apiEnviarAprovadas(ids) {
  return api_(function () {
    exigirAssistente_();
    return comTrava_(function () {
      const inicio = Date.now();
      const ctx = contextoEnvio_();
      const pedidos = new Set((ids || []).map(String));
      const fila = ctx.entregas.filter(function (e) { return e.STATUS === ST_APROVADA && pedidos.has(String(e.ID)); });
      const cota = MailApp.getRemainingDailyQuota();
      if (cota < fila.length) throw new Error('Cota diária de e-mails do Google insuficiente (' + cota + ' restantes). Tente amanhã.');

      const enviados = [], falhas = [];
      fila.forEach(function (e) {
        if (Date.now() - inicio > 4.5 * 60 * 1000) { falhas.push(e.EQUIPE + ': não deu tempo (toque em Enviar de novo)'); return; }
        try {
          enviarDevolutiva_(e, ctx, false);
          const agora = new Date();
          escreverCampos_(e._linha, {
            STATUS: '📨 Enviada em ' + Utilities.formatDate(agora, planilha_().getSpreadsheetTimeZone(), 'dd/MM HH:mm'),
            DATA_DEVOLUTIVA: agora, ATUALIZADO_EM: agora
          });
          registrarAcao_(quem_(), 'Devolutiva enviada', e.AULA, e.EQUIPE, e.CONCEITO);
          enviados.push(e.EQUIPE);
        } catch (err) {
          console.error(err && err.stack ? err.stack : err);
          escreverCampos_(e._linha, { AVISOS: [String(e.AVISOS || ''), 'Erro no envio: ' + err.message].filter(String).join(' | ') });
          falhas.push(e.EQUIPE + ': ' + err.message);
        }
      });
      return { enviados: enviados, falhas: falhas };
    });
  });
}

/** 👁️ Envia a devolutiva SÓ para você (pré-visualização), sem mudar nada. */
function apiEnviarTeste(id) {
  return api_(function () {
    exigirAssistente_();
    garantirParametrosEnvio_();
    const ctx = contextoEnvio_();
    const e = ctx.entregas.find(function (x) { return String(x.ID) === String(id); });
    if (!e) throw new Error('Entrega não encontrada.');
    if (CONCEITOS.indexOf(String(e.CONCEITO)) === -1) throw new Error('Esta entrega ainda não foi analisada.');
    enviarDevolutiva_(e, ctx, true);
    return { para: Session.getEffectiveUser().getEmail() };
  });
}

/* ------------------------------------------------------------------ */
/*  ENVIO                                                              */
/* ------------------------------------------------------------------ */

function exigirAssistente_() {
  if (!ACESSO || !ACESSO.dono) throw new Error('Só o assistente envia as devolutivas (os e-mails saem da conta dele).');
}

function garantirParametrosEnvio_() {
  garantirParametro_('MOSTRAR_CONCEITO_NO_EMAIL', 'SIM', 'SIM = o e-mail da devolutiva mostra o conceito (EXCELENTE, BOM…). NÃO = só o feedback.');
  garantirParametro_('MOSTRAR_CHECKLIST_NO_EMAIL', 'SIM', 'SIM = o e-mail mostra o checklist do que foi pedido (✅ 🟡 ❌).');
}

function contextoEnvio_() {
  const cfg = lerConfig_();
  return {
    cfg: cfg,
    entregas: lerAba_(ESQUEMA.ENTREGAS),
    equipes: lerAba_(ESQUEMA.EQUIPES),
    eu: String(Session.getEffectiveUser().getEmail() || '').toLowerCase()
  };
}

/**
 * Quem recebe: responde a quem enviou a entrega (se for da equipe),
 * com os demais integrantes em cópia (+ professor, se configurado).
 */
function destinatarios_(e, ctx) {
  const equipe = ctx.equipes.find(function (q) { return String(q.ID_EQUIPE) === String(e.ID_EQUIPE); });
  const integrantes = equipe ? extrairEmails_(equipe.EMAILS) : [];
  const rem = String(e.REMETENTE || '').toLowerCase();
  const excluidos = [ctx.eu].concat(extrairEmails_(ctx.cfg.EMAIL_PROFESSOR), extrairEmails_(ctx.cfg.EMAIL_ENTREGAS));
  // Se a entrega veio encaminhada (por você/professor), a resposta vai direto para a equipe
  const naConversa = !!rem && excluidos.indexOf(rem) === -1;
  const para = naConversa ? rem : (integrantes[0] || '');
  let cc = integrantes.filter(function (x) { return x !== para && excluidos.indexOf(x) === -1; });
  if (sim_(ctx.cfg.PROFESSOR_EM_COPIA)) cc = cc.concat(extrairEmails_(ctx.cfg.EMAIL_PROFESSOR));
  cc = cc.filter(function (x, i, a) { return x && a.indexOf(x) === i && x !== para; });
  return { para: para, cc: cc, naConversa: naConversa };
}

/** Monta e envia o e-mail (ou o teste para você). */
function enviarDevolutiva_(e, ctx, teste) {
  const conteudo = montarEmailDevolutiva_(e, ctx.cfg);
  const d = destinatarios_(e, ctx);
  if (teste) {
    GmailApp.sendEmail(ctx.eu, '[TESTE — não enviado à equipe] Re: ' + (e.ASSUNTO || e.AULA), conteudo.texto,
      { htmlBody: '<p style="font-family:Arial;color:#9a3412;background:#fff7ed;padding:10px;border-radius:8px">🧪 Pré-visualização. A equipe receberia em: <b>' +
        escaparTexto_(d.para) + '</b>' + (d.cc.length ? ' · cópia: ' + escaparTexto_(d.cc.join(', ')) : '') + '</p>' + conteudo.html });
    return;
  }
  if (!d.para) throw new Error('Sem destinatário: cadastre os e-mails da equipe na aba Equipes.');
  const opcoes = { htmlBody: conteudo.html };
  if (d.cc.length) opcoes.cc = d.cc.join(',');
  const nome = String(ctx.cfg.NOME_PROFESSOR || '').trim();
  if (nome) opcoes.name = nome;

  const msg = d.naConversa && e.ID_EMAIL ? GmailApp.getMessageById(String(e.ID_EMAIL)) : null;
  if (msg) {
    msg.reply(conteudo.texto, opcoes); // responde na mesma conversa
  } else {
    GmailApp.sendEmail(d.para, 'Re: ' + (e.ASSUNTO || 'Devolutiva — ' + e.AULA), conteudo.texto, opcoes);
  }
}

/** E-mail em HTML (e versão em texto). */
function montarEmailDevolutiva_(e, cfg) {
  const esc = escaparTexto_;
  const cores = COR_CONCEITO[String(e.CONCEITO)] || ['#f1f5f9', '#475569'];
  const mostrarConceito = sim_(cfg.MOSTRAR_CONCEITO_NO_EMAIL || 'SIM');
  const mostrarChecklist = sim_(cfg.MOSTRAR_CHECKLIST_NO_EMAIL || 'SIM');
  const checklist = lerChecklist_(e.CHECKLIST);
  const assinatura = esc(cfg.ASSINATURA_PROFESSOR || cfg.NOME_PROFESSOR || '').replace(/\r?\n/g, '<br>');
  const feedback = esc(e.FEEDBACK_EQUIPE || '').replace(/\r?\n/g, '<br>');
  const fonte = "font-family:'Segoe UI',Roboto,Arial,sans-serif";

  const html =
    '<div style="background:#f8fafc;padding:20px 10px;' + fonte + '">' +
    '<div style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">' +
      '<div style="padding:18px 24px;border-bottom:1px solid #e2e8f0">' +
        '<div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#64748b">Devolutiva da entrega</div>' +
        '<div style="font-size:20px;font-weight:700;color:#0f172a;margin-top:4px">' + esc(e.EQUIPE) + '</div>' +
        '<div style="font-size:14px;color:#475569;margin-top:2px">' + esc(e.AULA) + '</div>' +
      '</div>' +
      (mostrarConceito ? '<div style="padding:14px 24px 0 24px">' +
        '<span style="display:inline-block;padding:5px 14px;border-radius:999px;background:' + cores[0] + ';color:' + cores[1] + ';font-weight:700;font-size:13px;letter-spacing:.04em">' + esc(e.CONCEITO) + '</span>' +
        (e.EVOLUCAO ? '<span style="margin-left:10px;font-size:13px;color:#475569">' + esc(e.EVOLUCAO) + '</span>' : '') +
      '</div>' : '') +
      '<div style="padding:16px 24px;font-size:14.5px;line-height:1.65;color:#1e293b">' + feedback + '</div>' +
      (mostrarChecklist && checklist.length ? '<div style="padding:0 24px 16px 24px">' +
        '<div style="font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#64748b;margin-bottom:6px">O que foi pedido nesta entrega</div>' +
        '<table role="presentation" style="width:100%;border-collapse:collapse;font-size:13.5px">' +
        checklist.map(function (c) {
          return '<tr><td style="padding:6px 0;border-top:1px solid #f1f5f9;color:#334155">' + esc(c.item) + '</td>' +
            '<td style="padding:6px 0 6px 12px;border-top:1px solid #f1f5f9;white-space:nowrap;color:#334155;text-align:right">' + (ROTULO_ITEM[c.status] || '') + '</td></tr>';
        }).join('') + '</table></div>' : '') +
      '<div style="padding:16px 24px;border-top:1px solid #e2e8f0;font-size:13px;color:#334155;line-height:1.5">' + assinatura + '</div>' +
    '</div></div>';

  const texto = [
    'DEVOLUTIVA — ' + e.EQUIPE, String(e.AULA),
    mostrarConceito ? 'Conceito: ' + e.CONCEITO + (e.EVOLUCAO ? ' · ' + e.EVOLUCAO : '') : '',
    '', String(e.FEEDBACK_EQUIPE || ''), '',
    mostrarChecklist && checklist.length ? 'O que foi pedido:\n' + checklist.map(function (c) { return '- ' + c.item + ': ' + (ROTULO_ITEM[c.status] || ''); }).join('\n') + '\n' : '',
    '--', String(cfg.ASSINATURA_PROFESSOR || cfg.NOME_PROFESSOR || '')
  ].filter(function (l, i) { return l !== '' || i === 3 || i === 5; }).join('\n');

  return { html: html, texto: texto };
}

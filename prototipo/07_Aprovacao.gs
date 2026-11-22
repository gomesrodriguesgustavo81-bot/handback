/**
 * =====================================================================
 *  Arquivo 07_Aprovacao — PASSO 5
 *  • Link pessoal do professor (funciona fora do seu domínio)
 *  • Professor edita o feedback, troca o conceito e APROVA
 *  • Aviso por e-mail ao professor quando a aula está pronta
 *  Nada é enviado às equipes aqui (o envio é o Passo 6).
 *
 *  COMO GERAR O LINK DO PROFESSOR:
 *    no Apps Script, escolha "gerarLinkProfessor" › ▷ Executar.
 *    O link aparece no "Registro de execução" e, se EMAIL_PROFESSOR
 *    estiver preenchido na Config, também é enviado por e-mail.
 *  COMO CORTAR O ACESSO:
 *    escolha "revogarLinksProfessor" › ▷ Executar.
 * =====================================================================
 */

const VERSAO_APROVACAO = 'Passo 10 · 2026-11-19';
const ST_APROVADA = 'Aprovada';

/* ------------------------------------------------------------------ */
/*  LINK PESSOAL                                                       */
/* ------------------------------------------------------------------ */

/** Resumo SHA-256 (só o resumo do link é guardado, nunca a chave em si). */
function resumoChave_(t) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function lerLinks_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('LINKS_PESSOAIS') || '[]'); }
  catch (e) { return []; }
}

/** Usado pelo 02_App: devolve {nome, dono:false} se o link for válido. */
function validarLinkPessoal_(token) {
  if (!token || token.length < 32) return null;
  const h = resumoChave_(token);
  const p = lerLinks_().find(function (x) { return x.hash === h; });
  return p ? { nome: p.nome, dono: false } : null;
}

/** 👤 Cria o link pessoal do professor (rode pelo editor). */
function gerarLinkProfessor() {
  const url = ScriptApp.getService().getUrl();
  if (!url) return alerta_('Publique o app primeiro', 'Implantar › Nova implantação › App da Web.');
  const cfg = lerConfig_();
  const nome = cfg.NOME_PROFESSOR || 'Professor';
  const chave = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const links = lerLinks_();
  const email = extrairEmails_(cfg.EMAIL_PROFESSOR)[0];
  const hash = resumoChave_(chave);
  links.push({ nome: nome, email: email || '', hash: hash, criadoEm: new Date().toISOString() });
  const props = PropertiesService.getScriptProperties();
  props.setProperty('LINKS_PESSOAIS', JSON.stringify(links));
  const link = url + '?k=' + chave;
  props.setProperty('LINK_PROFESSOR', link); // compatibilidade com o aviso antigo
  let planos = {};
  try { planos = JSON.parse(props.getProperty('LINKS_PLANOS') || '{}'); } catch (e) { planos = {}; }
  planos[hash] = link;
  props.setProperty('LINKS_PLANOS', JSON.stringify(planos));

  if (email) {
    MailApp.sendEmail({
      to: email,
      subject: 'Seu acesso ao app de avaliação das entregas',
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">' +
        '<p>Olá, ' + escaparTexto_(nome) + '!</p>' +
        '<p>Este é o seu link pessoal para revisar e aprovar as devolutivas das equipes:</p>' +
        '<p><a href="' + link + '" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">Abrir o app</a></p>' +
        '<p style="color:#64748b;font-size:12px">O link é pessoal: não encaminhe. Abra logado em qualquer conta Google. ' +
        'No celular, use "Adicionar à tela inicial".</p></div>',
      body: 'Seu link pessoal: ' + link
    });
  }
  registrarAcao_('Assistente', 'Link do professor criado', '', '', nome + (email ? ' (enviado para ' + email + ')' : ''));
  const texto = '👤 Link pessoal de ' + nome + ':\n\n' + link + '\n\n' +
    (email ? '✅ Enviado por e-mail para ' + email + '.' : '⚠️ EMAIL_PROFESSOR vazio na Config: copie o link acima e envie por um canal privado.') +
    '\n\nO link é como uma senha. Para cortar o acesso: rode "revogarLinksProfessor".';
  console.log(texto);
  alerta_('👤 Link do professor', texto);
  return texto;
}

/** ⛔ Corta todos os links pessoais (rode pelo editor). */
function revogarLinksProfessor() {
  const props = PropertiesService.getScriptProperties();
  const n = lerLinks_().length;
  props.deleteProperty('LINKS_PESSOAIS');
  props.deleteProperty('LINK_PROFESSOR');
  props.deleteProperty('LINKS_PLANOS');
  registrarAcao_('Assistente', 'Links do professor revogados', '', '', n + ' link(s)');
  const texto = '⛔ ' + n + ' link(s) revogado(s). Quem tinha o link não consegue mais entrar. Gere um novo com "gerarLinkProfessor".';
  console.log(texto);
  alerta_('⛔ Acesso revogado', texto);
  return texto;
}

function escaparTexto_(t) {
  return String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/*  PORTA DE ENTRADA DO APP (identifica quem chama)                    */
/* ------------------------------------------------------------------ */

/**
 * Todas as chamadas do app passam por aqui: confere o link pessoal
 * (ou se é você) e então executa a função pedida.
 */
function apiRun(token, nome, args) {
  ACESSO = identificarUsuario_(String(token || '').replace(/[^a-zA-Z0-9]/g, ''));
  if (!ACESSO) return JSON.stringify({ ok: false, erro: 'Acesso negado. Peça um novo link pessoal.' });
  const permitidas = {
    apiInicio: typeof apiInicio === 'function' ? apiInicio : null,
    apiTriagem: typeof apiTriagem === 'function' ? apiTriagem : null,
    apiDecidirTriagem: typeof apiDecidirTriagem === 'function' ? apiDecidirTriagem : null,
    apiBuscarEntregas: typeof apiBuscarEntregas === 'function' ? apiBuscarEntregas : null,
    apiPendentesAnalise: typeof apiPendentesAnalise === 'function' ? apiPendentesAnalise : null,
    apiAnalisarUma: typeof apiAnalisarUma === 'function' ? apiAnalisarUma : null,
    apiReanalisar: typeof apiReanalisar === 'function' ? apiReanalisar : null,
    apiDetalhes: typeof apiDetalhes === 'function' ? apiDetalhes : null,
    apiCorrigirEntrega: typeof apiCorrigirEntrega === 'function' ? apiCorrigirEntrega : null,
    apiExcluirEntrega: typeof apiExcluirEntrega === 'function' ? apiExcluirEntrega : null,
    apiSalvarFeedback: apiSalvarFeedback,
    apiMudarConceito: apiMudarConceito,
    apiAprovar: apiAprovar,
    apiAprovarTodas: apiAprovarTodas,
    apiAvisarProfessor: apiAvisarProfessor,
    // Passo 6 em diante (só ficam ativas quando o arquivo correspondente existir)
    apiFilaEnvio: typeof apiFilaEnvio === 'function' ? apiFilaEnvio : null,
    apiEnviarAprovadas: typeof apiEnviarAprovadas === 'function' ? apiEnviarAprovadas : null,
    apiEnviarTeste: typeof apiEnviarTeste === 'function' ? apiEnviarTeste : null,
    apiRelatorioAula: typeof apiRelatorioAula === 'function' ? apiRelatorioAula : null,
    apiGerarRelatorio: typeof apiGerarRelatorio === 'function' ? apiGerarRelatorio : null,
    // Passo 9: aulas, equipes, professores e ajustes pelo app
    apiGestao: typeof apiGestao === 'function' ? apiGestao : null,
    apiSalvarAula: typeof apiSalvarAula === 'function' ? apiSalvarAula : null,
    apiExcluirAula: typeof apiExcluirAula === 'function' ? apiExcluirAula : null,
    apiInstrucoesAula: typeof apiInstrucoesAula === 'function' ? apiInstrucoesAula : null,
    apiSalvarEquipe: typeof apiSalvarEquipe === 'function' ? apiSalvarEquipe : null,
    apiExcluirEquipe: typeof apiExcluirEquipe === 'function' ? apiExcluirEquipe : null,
    apiSalvarConfig: typeof apiSalvarConfig === 'function' ? apiSalvarConfig : null,
    apiVerificar: typeof apiVerificar === 'function' ? apiVerificar : null,
    apiProfessores: typeof apiProfessores === 'function' ? apiProfessores : null
  };
  // Arquivos novos (11_Drive em diante) se registram em API_EXTRA: não é preciso mudar este arquivo de novo.
  const extras = (typeof API_EXTRA !== 'undefined' && API_EXTRA) || {};
  const fn = permitidas[nome] || (/^api[A-Z]/.test(nome) && typeof extras[nome] === 'function' ? extras[nome] : null);
  if (!fn) return JSON.stringify({ ok: false, erro: 'Função não disponível: ' + nome });
  return fn.apply(null, Array.isArray(args) ? args : []);
}

/* ------------------------------------------------------------------ */
/*  REVISÃO E APROVAÇÃO                                                */
/* ------------------------------------------------------------------ */

/** Busca uma entrega editável (analisada e ainda não enviada). */
function entregaEditavel_(id) {
  const entregas = lerAba_(ESQUEMA.ENTREGAS);
  const e = entregas.find(function (x) { return String(x.ID) === String(id); });
  if (!e) throw new Error('Entrega não encontrada. Atualize a tela.');
  if (/enviad/i.test(String(e.STATUS))) throw new Error('A devolutiva desta entrega já foi enviada: não dá mais para alterar.');
  if (CONCEITOS.indexOf(String(e.CONCEITO)) === -1) throw new Error('Esta entrega ainda não foi analisada.');
  return { e: e, entregas: entregas };
}

/**
 * ✏️ Salva o feedback editado. Se outra pessoa mudou o texto depois que
 * esta tela abriu (base diferente), recusa para não apagar a edição dela.
 */
function apiSalvarFeedback(id, texto, base) {
  return api_(function () {
    return comTrava_(function () {
      const x = entregaEditavel_(id);
      const t = String(texto || '').trim();
      if (!t) throw new Error('O feedback não pode ficar vazio.');
      const atual = String(x.e.FEEDBACK_EQUIPE || '');
      if (base !== undefined && base !== null && String(base) !== atual && atual !== t) {
        throw new Error('CONFLITO: outra pessoa alterou este feedback enquanto você editava. Copie o seu texto, atualize a tela e cole de novo.');
      }
      escreverCampos_(x.e._linha, { FEEDBACK_EQUIPE: t, ATUALIZADO_EM: new Date() });
      registrarAcao_(quem_(), 'Feedback editado', x.e.AULA, x.e.EQUIPE, t.slice(0, 120));
      return { ok: true };
    });
  });
}

/** 🔁 Professor troca o conceito (a evolução e a jornada são recalculadas). */
function apiMudarConceito(id, conceito) {
  return api_(function () {
    return comTrava_(function () {
      const novo = String(conceito || '').toUpperCase();
      if (CONCEITOS.indexOf(novo) === -1) throw new Error('Conceito inválido.');
      const x = entregaEditavel_(id);
      const antes = String(x.e.CONCEITO);
      if (antes === novo) return { ok: true };
      const traj = trajetoria_(entregasAnteriores_(x.entregas, x.e), novo);
      escreverCampos_(x.e._linha, {
        CONCEITO: novo,
        EVOLUCAO: traj.evolucao,
        JORNADA: traj.jornada,
        JUSTIFICATIVA: String(x.e.JUSTIFICATIVA || '') + ' [Conceito alterado por ' + quem_() + ': ' + antes + ' → ' + novo + '.]',
        ATUALIZADO_EM: new Date()
      });
      registrarAcao_(quem_(), 'Conceito alterado', x.e.AULA, x.e.EQUIPE, antes + ' → ' + novo);
      return { ok: true, evolucao: traj.evolucao, jornada: traj.jornada };
    });
  });
}

/** ✅ Aprova (ou desfaz a aprovação de) uma entrega. */
function apiAprovar(id, aprovar) {
  return api_(function () {
    return comTrava_(function () {
      const x = entregaEditavel_(id);
      if (aprovar) {
        if (!String(x.e.FEEDBACK_EQUIPE || '').trim()) throw new Error('Escreva o feedback antes de aprovar.');
        escreverCampos_(x.e._linha, { STATUS: ST_APROVADA, APROVADO_POR: quem_(), DATA_APROVACAO: new Date(), ATUALIZADO_EM: new Date() });
        registrarAcao_(quem_(), 'Devolutiva aprovada', x.e.AULA, x.e.EQUIPE, x.e.CONCEITO);
      } else {
        escreverCampos_(x.e._linha, { STATUS: ST_ANALISADA, APROVADO_POR: '', DATA_APROVACAO: '', ATUALIZADO_EM: new Date() });
        registrarAcao_(quem_(), 'Aprovação desfeita', x.e.AULA, x.e.EQUIPE, '');
      }
      return { ok: true };
    });
  });
}

/** ✅✅ Aprova todas as entregas analisadas de uma aula. */
function apiAprovarTodas(idAula) {
  return api_(function () {
    return comTrava_(function () {
      const alvo = lerAba_(ESQUEMA.ENTREGAS).filter(function (e) {
        return String(e.ID_AULA) === String(idAula) && e.STATUS === ST_ANALISADA && String(e.FEEDBACK_EQUIPE || '').trim();
      });
      alvo.forEach(function (e) {
        escreverCampos_(e._linha, { STATUS: ST_APROVADA, APROVADO_POR: quem_(), DATA_APROVACAO: new Date(), ATUALIZADO_EM: new Date() });
      });
      if (alvo.length) registrarAcao_(quem_(), 'Aprovou todas', alvo[0].AULA, '', alvo.length + ' entrega(s)');
      return { total: alvo.length };
    });
  });
}

/** 📣 Avisa o professor por e-mail que a aula está pronta para revisão. */
function apiAvisarProfessor(idAula) {
  return api_(function () {
    if (!ACESSO || !ACESSO.dono) throw new Error('Só o assistente pode enviar o aviso.');
    if (typeof avisarTodosProfessores_ === 'function') {
      const r = avisarTodosProfessores_(idAula);
      if (r) return r;
    }
    const cfg = lerConfig_();
    const para = extrairEmails_(cfg.EMAIL_PROFESSOR)[0];
    if (!para) throw new Error('Preencha EMAIL_PROFESSOR na aba Config.');
    const link = PropertiesService.getScriptProperties().getProperty('LINK_PROFESSOR');
    if (!link) throw new Error('Gere o link do professor primeiro (no Apps Script: gerarLinkProfessor).');
    const aula = lerAba_(ESQUEMA.AULAS).find(function (a) { return String(a.ID_AULA) === String(idAula); });
    const ents = lerAba_(ESQUEMA.ENTREGAS).filter(function (e) { return String(e.ID_AULA) === String(idAula); });
    const aguardando = ents.filter(function (e) { return e.STATUS === ST_ANALISADA; }).length;
    const titulo = aula ? 'Aula ' + aula.NUMERO + ' — ' + aula.TITULO : 'a aula';
    MailApp.sendEmail({
      to: para,
      subject: 'Devolutivas prontas para revisão: ' + titulo,
      htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a">' +
        '<p>Olá, ' + escaparTexto_(cfg.NOME_PROFESSOR || 'professor') + '!</p>' +
        '<p>A análise de <b>' + escaparTexto_(titulo) + '</b> está pronta: <b>' + aguardando + '</b> devolutiva(s) aguardando a sua aprovação.</p>' +
        '<p><a href="' + link + '" style="display:inline-block;background:#0f172a;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:bold">Revisar e aprovar</a></p></div>',
      body: 'A análise de ' + titulo + ' está pronta (' + aguardando + ' aguardando aprovação). Acesse: ' + link
    });
    registrarAcao_('Assistente', 'Aviso enviado ao professor', titulo, '', aguardando + ' aguardando');
    return { ok: true, aguardando: aguardando };
  });
}

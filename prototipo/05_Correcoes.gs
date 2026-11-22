/**
 * =====================================================================
 *  Arquivo 05_Correcoes — corrigir aula/equipe e excluir entregas
 *  • ✏️ Corrigir: troca a aula e/ou a equipe de uma entrega. Se mudou,
 *    a análise anterior é descartada e a entrega volta para "Recebida"
 *    (para a IA analisar de novo com o pedido da aula certa).
 *    Se uma entrega verdadeira tinha sido marcada "Substituída" por
 *    engano, ela é restaurada.
 *  • 🗑️ Excluir: tira a entrega do sistema (status "Ignorada"). A linha
 *    continua na planilha como histórico e o e-mail não é importado de novo.
 *  Entregas com devolutiva já enviada não podem ser alteradas.
 * =====================================================================
 */

const VERSAO_CORRECOES = 'Correções · 2026-11-19';

/** ✏️ Corrige aula e/ou equipe de uma entrega (também serve para aceitar "Para confirmar"). */
function apiCorrigirEntrega(id, idAula, idEquipe) {
  return api_(function () {
    return comTrava_(function () {
      const entregas = lerAba_(ESQUEMA.ENTREGAS);
      const e = entregas.find(function (x) { return String(x.ID) === String(id); });
      if (!e) throw new Error('Entrega não encontrada. Atualize a tela.');
      if (/enviad/i.test(String(e.STATUS))) throw new Error('A devolutiva desta entrega já foi enviada: não dá para alterar.');

      const aula = lerAba_(ESQUEMA.AULAS).find(function (a) { return String(a.ID_AULA) === String(idAula); });
      const equipe = lerAba_(ESQUEMA.EQUIPES).find(function (q) { return String(q.ID_EQUIPE) === String(idEquipe); });
      if (!aula) throw new Error('Escolha uma aula válida.');
      if (!equipe) throw new Error('Escolha uma equipe válida.');

      const antes = { ID_AULA: e.ID_AULA, ID_EQUIPE: e.ID_EQUIPE, AULA: e.AULA, EQUIPE: e.EQUIPE };
      const mudou = String(antes.ID_AULA) !== String(aula.ID_AULA) || String(antes.ID_EQUIPE) !== String(equipe.ID_EQUIPE);
      const fim = aula.RECEBE_ATE instanceof Date ? aula.RECEBE_ATE.getTime() + 86399999 : Infinity;
      const enviadoEm = e.DATA_ENVIO instanceof Date ? e.DATA_ENVIO.getTime() : 0;

      const campos = {
        ID_AULA: aula.ID_AULA,
        AULA: 'Aula ' + aula.NUMERO + ' — ' + aula.TITULO,
        PEDIDO: textoPedido_(aula),
        ID_EQUIPE: equipe.ID_EQUIPE,
        EQUIPE: equipe.NOME,
        ATRASO: enviadoEm > fim ? 'SIM' : 'NÃO',
        AVISOS: [String(e.AVISOS || ''), mudou ? 'Corrigida manualmente: ' + (antes.AULA || '?') + ' / ' + (antes.EQUIPE || '?') + ' → ' + 'Aula ' + aula.NUMERO + ' / ' + equipe.NOME : '']
          .filter(String).join(' | '),
        ATUALIZADO_EM: new Date()
      };
      if (mudou || e.STATUS === ST.POSSIVEL) {
        campos.STATUS = ST.RECEBIDA;
        if (mudou) {
          // A análise anterior foi feita com o pedido da aula errada: descarta
          ['CHECKLIST', 'CONCEITO', 'JUSTIFICATIVA', 'EVOLUCAO', 'JORNADA', 'ANALISE_PROFESSOR', 'FEEDBACK_EQUIPE', 'MODELO_IA']
            .forEach(function (k) { campos[k] = ''; });
        }
      }
      escreverCampos_(e._linha, campos);
      Object.assign(e, campos);

      substituirAnteriores_(entregas, e);
      if (mudou) restaurarSubstituida_(entregas, antes.ID_EQUIPE, antes.ID_AULA, e);
      marcarNoGmail_(e.ID_CONVERSA);
      registrarAcao_('App', 'Entrega corrigida', campos.AULA, campos.EQUIPE,
        'Antes: ' + (antes.AULA || '?') + ' / ' + (antes.EQUIPE || '?'));
      return { mudou: mudou, status: e.STATUS };
    });
  });
}

/** 🗑️ Exclui uma entrega (fica como "Ignorada"; o e-mail não volta a ser importado). */
function apiExcluirEntrega(id) {
  return api_(function () {
    return comTrava_(function () {
      const entregas = lerAba_(ESQUEMA.ENTREGAS);
      const e = entregas.find(function (x) { return String(x.ID) === String(id); });
      if (!e) throw new Error('Entrega não encontrada. Atualize a tela.');
      if (/enviad/i.test(String(e.STATUS))) throw new Error('A devolutiva desta entrega já foi enviada: não dá para excluir.');
      escreverCampos_(e._linha, { STATUS: ST.IGNORADA, AVISOS: [String(e.AVISOS || ''), 'Excluída manualmente'].filter(String).join(' | '), ATUALIZADO_EM: new Date() });
      e.STATUS = ST.IGNORADA;
      restaurarSubstituida_(entregas, e.ID_EQUIPE, e.ID_AULA, e);
      registrarAcao_('App', 'Entrega excluída', e.AULA, e.EQUIPE, String(e.ASSUNTO || ''));
      return { ok: true };
    });
  });
}

/**
 * Se a equipe ficou sem entrega ativa naquela aula, restaura a mais recente
 * que tinha sido marcada "Substituída" (ela foi substituída por engano).
 */
function restaurarSubstituida_(entregas, idEquipe, idAula, ignorar) {
  if (!idEquipe || !idAula) return;
  const daCombinacao = entregas.filter(function (x) {
    return x !== ignorar && String(x.ID_EQUIPE) === String(idEquipe) && String(x.ID_AULA) === String(idAula);
  });
  const ativa = daCombinacao.some(function (x) { return [ST.SUBSTITUIDA, ST.IGNORADA, ST.POSSIVEL].indexOf(x.STATUS) === -1; });
  if (ativa) return;
  const candidatas = daCombinacao.filter(function (x) { return x.STATUS === ST.SUBSTITUIDA; })
    .sort(function (a, b) { return (b.DATA_ENVIO || 0) - (a.DATA_ENVIO || 0); });
  if (!candidatas.length) return;
  const r = candidatas[0];
  const novo = CONCEITOS.indexOf(String(r.CONCEITO)) !== -1 ? ST_ANALISADA : ST.RECEBIDA;
  escreverCampos_(r._linha, { STATUS: novo, ATUALIZADO_EM: new Date() });
  r.STATUS = novo;
  registrarAcao_('App', 'Entrega restaurada', r.AULA, r.EQUIPE, 'Estava como Substituída por engano');
}

/** Executa com trava (evita duas alterações ao mesmo tempo). */
function comTrava_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Outra operação está em andamento. Tente de novo em instantes.');
  try { return fn(); } finally { lock.releaseLock(); }
}

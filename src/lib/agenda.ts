import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decifrar, ErroGmail, tokenDeAcesso } from "./gmail";
import { somarDias } from "./lembretes";
import { completarVocabulario } from "./nomes";
import type { Vocabulario } from "./frentes";

/**
 * Google Agenda: cada turma pode ter a agenda "Handback · <turma>" na conta
 * de quem ligou. A permissão (calendar.app.created) só deixa o Handback
 * mexer nas agendas que ele mesmo criou.
 */
export type ItemAgenda = "prazo" | "abre" | "aula";

function base() {
  const b = process.env.HANDBACK_GOOGLE_BASE?.replace(/\/$/, "");
  return b ? `${b}/calendar/v3` : "https://www.googleapis.com/calendar/v3";
}

class ErroAgenda extends Error {
  constructor(
    mensagem: string,
    public status = 0,
  ) {
    super(mensagem);
  }
}

async function chamar(acesso: string, metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`${base()}${caminho}`, {
    method: metodo,
    headers: { authorization: `Bearer ${acesso}`, ...(corpo ? { "content-type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (r.status === 204) return {};
  const j = (await r.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!r.ok) throw new ErroAgenda(j.error?.message ?? `erro ${r.status}`, r.status);
  return j;
}

/** Abre a conexão da Agenda de uma pessoa. Devolve null se não houver (ou se expirou). */
export async function acessoDaAgenda(admin: SupabaseClient, userId: string): Promise<{ email: string; acesso: string } | null> {
  const { data } = await admin.from("conexoes_google").select("email, token_cifrado, invalida").eq("user_id", userId).eq("servico", "agenda").maybeSingle();
  if (!data || data.invalida) return null;
  try {
    return { email: data.email, acesso: await tokenDeAcesso(decifrar(data.token_cifrado)) };
  } catch (e) {
    if (e instanceof ErroGmail && e.reconectar) await admin.from("conexoes_google").update({ invalida: true }).eq("user_id", userId).eq("servico", "agenda");
    return null;
  }
}

type Evento = {
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
  transparency: "transparent";
  reminders: { useDefault: boolean; overrides?: { method: "popup"; minutes: number }[] };
  attendees?: { email: string }[];
  source?: { title: string; url: string };
};

export type ResultadoAgenda = { ok: boolean; criados: number; mudados: number; apagados: number; mensagem: string };

/**
 * Deixa a agenda da turma igual ao Handback: cria, muda e apaga eventos.
 * Só mexe no que mudou (cada evento guarda uma "assinatura" do conteúdo).
 */
export async function sincronizarAgenda(admin: SupabaseClient, turmaId: string, site: string, tentativa = 1): Promise<ResultadoAgenda> {
  const r: ResultadoAgenda = { ok: true, criados: 0, mudados: 0, apagados: 0, mensagem: "" };
  const { data: t } = await admin
    .from("turmas")
    .select("id, nome, org_id, arquivada, agenda_por, agenda_id, agenda_itens, agenda_convidar, organizacoes(slug, vocabulario)")
    .eq("id", turmaId)
    .maybeSingle();
  if (!t?.agenda_por) return { ...r, mensagem: "agenda desligada" };
  const con = await acessoDaAgenda(admin, t.agenda_por);
  if (!con) {
    await admin.from("turmas").update({ agenda_erro: "A conexão com o Google Agenda expirou ou foi desconectada." }).eq("id", t.id);
    return { ...r, ok: false, mensagem: "sem conexão com a Agenda" };
  }
  const org = t.organizacoes as unknown as { slug: string; vocabulario: Vocabulario };
  const vc = completarVocabulario(org.vocabulario);

  // Eventos de etapas apagadas, guardados pelo banco para apagar aqui.
  const { data: lixo } = await admin.from("agenda_apagar").select("id, agenda_id, evento_id").eq("user_id", t.agenda_por).limit(100);
  for (const l of lixo ?? []) {
    await chamar(con.acesso, "DELETE", `/calendars/${encodeURIComponent(l.agenda_id)}/events/${encodeURIComponent(l.evento_id)}`).catch(() => undefined);
    await admin.from("agenda_apagar").delete().eq("id", l.id);
    r.apagados++;
  }

  let agendaId: string = t.agenda_id ?? "";
  const criarAgenda = async () => {
    const nova = await chamar(con.acesso, "POST", "/calendars", { summary: `Handback · ${t.nome}`, timeZone: "America/Sao_Paulo", description: "Prazos e aberturas das entregas, mantidos pelo Handback." });
    agendaId = String(nova.id);
    await admin.from("agenda_eventos").delete().eq("turma_id", t.id);
    await admin.from("turmas").update({ agenda_id: agendaId }).eq("id", t.id);
  };

  try {
    if (!agendaId) await criarAgenda();
    const [{ data: etapas }, { data: existentes }, { data: pessoas }] = await Promise.all([
      admin.from("etapas").select("id, numero, titulo, data, recebe_de, recebe_ate, entregaveis").eq("turma_id", t.id).order("numero"),
      admin.from("agenda_eventos").select("etapa_id, tipo, evento_id, assinatura").eq("turma_id", t.id),
      t.agenda_convidar
        ? admin.from("integrantes").select("email, grupos!inner(ativo, escondido)").eq("turma_id", t.id).eq("grupos.ativo", true).eq("grupos.escondido", false)
        : Promise.resolve({ data: [] as { email: string }[] }),
    ]);
    const itens = new Set((t.agenda_itens as string[]) ?? []);
    const convidados = t.agenda_convidar ? [...new Set((pessoas ?? []).map((p) => p.email))].slice(0, 200).map((email) => ({ email })) : [];
    const link = `${site.replace(/\/$/, "")}/app/${org.slug}/etapas`;

    const desejados = new Map<string, { etapa: string; tipo: ItemAgenda; evento: Evento }>();
    for (const e of t.arquivada ? [] : (etapas ?? [])) {
      const nome = `${vc.etapa} ${e.numero} · ${e.titulo}`;
      const oQue = (e.entregaveis as string[]).length ? `Entregar: ${(e.entregaveis as string[]).join("; ")}.` : "";
      const add = (tipo: ItemAgenda, dia: string | null, titulo: string, lembrete: boolean) => {
        if (!dia || !itens.has(tipo)) return;
        desejados.set(`${e.id}:${tipo}`, {
          etapa: e.id,
          tipo,
          evento: {
            summary: titulo,
            description: [oQue, `${t.nome} · Handback`].filter(Boolean).join("\n\n"),
            start: { date: dia },
            end: { date: somarDias(dia, 1) },
            transparency: "transparent",
            reminders: lembrete ? { useDefault: false, overrides: [{ method: "popup", minutes: 24 * 60 }] } : { useDefault: false },
            ...(convidados.length && tipo !== "aula" ? { attendees: convidados } : {}),
            ...(/^https:\/\//.test(link) ? { source: { title: "Abrir no Handback", url: link } } : {}),
          },
        });
      };
      add("prazo", e.recebe_ate, `Prazo: ${nome}`, true);
      add("abre", e.recebe_de, `Abre para entregas: ${nome}`, false);
      add("aula", e.data, nome, false);
    }

    const avisar = t.agenda_convidar ? "all" : "none";
    const porChave = new Map((existentes ?? []).map((x) => [`${x.etapa_id}:${x.tipo}`, x]));
    for (const [chave, d] of desejados) {
      const assinatura = createHash("sha256").update(JSON.stringify(d.evento)).digest("hex").slice(0, 32);
      const ja = porChave.get(chave);
      if (ja && ja.assinatura === assinatura) continue;
      const caminho = `/calendars/${encodeURIComponent(agendaId)}/events`;
      let id = ja?.evento_id;
      if (id) {
        try {
          await chamar(con.acesso, "PUT", `${caminho}/${encodeURIComponent(id)}?sendUpdates=${avisar}`, d.evento);
          r.mudados++;
        } catch (e) {
          if (!(e instanceof ErroAgenda) || (e.status !== 404 && e.status !== 410)) throw e;
          id = undefined;
        }
      }
      if (!id) {
        const novo = await chamar(con.acesso, "POST", `${caminho}?sendUpdates=${avisar}`, d.evento);
        id = String(novo.id);
        r.criados++;
      }
      await admin.from("agenda_eventos").upsert({ etapa_id: d.etapa, tipo: d.tipo, turma_id: t.id, agenda_id: agendaId, evento_id: id, assinatura }, { onConflict: "etapa_id,tipo" });
    }
    for (const [chave, x] of porChave) {
      if (desejados.has(chave)) continue;
      await chamar(con.acesso, "DELETE", `/calendars/${encodeURIComponent(agendaId)}/events/${encodeURIComponent(x.evento_id)}?sendUpdates=${avisar}`).catch(() => undefined);
      await admin.from("agenda_eventos").delete().match({ etapa_id: x.etapa_id, tipo: x.tipo });
      r.apagados++;
    }
    await admin.from("turmas").update({ agenda_erro: "", agenda_em: new Date().toISOString() }).eq("id", t.id);
    return r;
  } catch (e) {
    // A pessoa apagou a agenda no Google: na próxima vez, o Handback cria de novo.
    if (e instanceof ErroAgenda && (e.status === 404 || e.status === 410)) {
      await admin.from("turmas").update({ agenda_id: null }).eq("id", t.id);
      await admin.from("agenda_eventos").delete().eq("turma_id", t.id);
      if (tentativa === 1) return sincronizarAgenda(admin, turmaId, site, 2);
    }
    if (e instanceof ErroAgenda && e.status === 401) {
      await admin.from("conexoes_google").update({ invalida: true }).eq("user_id", t.agenda_por).eq("servico", "agenda");
    }
    const mensagem = e instanceof Error ? e.message : String(e);
    await admin.from("turmas").update({ agenda_erro: `O Google Agenda recusou: ${mensagem}`.slice(0, 300) }).eq("id", t.id);
    return { ...r, ok: false, mensagem };
  }
}

/** Sincroniza todas as turmas com agenda ligada (rodada diária, por segurança). */
export async function sincronizarTodasAsAgendas(admin: SupabaseClient, site: string): Promise<number> {
  const { data } = await admin.from("turmas").select("id").not("agenda_por", "is", null);
  let n = 0;
  for (const t of data ?? []) if ((await sincronizarAgenda(admin, t.id, site)).ok) n++;
  return n;
}

/** Apaga a agenda "Handback · <turma>" da conta de quem ligou (quando desliga a agenda da turma). */
export async function apagarAgendaDaTurma(admin: SupabaseClient, turmaId: string): Promise<void> {
  const { data: t } = await admin.from("turmas").select("agenda_por, agenda_id").eq("id", turmaId).maybeSingle();
  if (t?.agenda_por && t.agenda_id) {
    const con = await acessoDaAgenda(admin, t.agenda_por);
    if (con) await chamar(con.acesso, "DELETE", `/calendars/${encodeURIComponent(t.agenda_id)}`).catch(() => undefined);
  }
  await admin.from("agenda_eventos").delete().eq("turma_id", turmaId);
  await admin.from("agenda_apagar").delete().eq("agenda_id", t?.agenda_id ?? "");
  await admin.from("turmas").update({ agenda_por: null, agenda_id: null, agenda_erro: "", agenda_em: null }).eq("id", turmaId);
}

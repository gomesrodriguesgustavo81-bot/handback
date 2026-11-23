import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enderecoDeRecebimento } from "./emails/endereco";
import { montarAviso, remetenteComNome } from "./emails/montar";
import { preferenciasDeEnvio } from "./envio";
import { decifrar, enviarPeloGmail, ErroGmail, tokenDeAcesso } from "./gmail";
import { diasDosLembretes, somarDias, type TipoLembrete } from "./lembretes";
import { completarVocabulario } from "./nomes";
import { despacharPush } from "./push";
import type { Vocabulario } from "./frentes";

const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function diaPorExtenso(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

type Gmail = { email: string; acesso: string; de: string };
/** Abre o Gmail de alguém para enviar (guarda em memória durante a rodada). */
async function abrirGmail(admin: SupabaseClient, userId: string, cache: Map<string, Gmail | null>): Promise<Gmail | null> {
  if (cache.has(userId)) return cache.get(userId)!;
  let g: Gmail | null = null;
  const { data } = await admin.from("contas_gmail").select("email, token_cifrado, invalida").eq("user_id", userId).maybeSingle();
  if (data && !data.invalida) {
    try {
      const eu = await preferenciasDeEnvio(admin, userId);
      g = { email: data.email, acesso: await tokenDeAcesso(decifrar(data.token_cifrado)), de: remetenteComNome(data.email, eu.nome) };
    } catch (e) {
      if (e instanceof ErroGmail && e.reconectar) await admin.from("contas_gmail").update({ invalida: true }).eq("user_id", userId);
    }
  }
  cache.set(userId, g);
  return g;
}

export type ResultadoDiario = { lembretes: number; falhas: number; prazos: number; resumos: number; push: number };

/** Tudo o que sai uma vez por dia, às 9h: lembretes aos alunos, aviso de prazo e resumo por e-mail. */
export async function rodarDiario(admin: SupabaseClient, hoje: string, site: string): Promise<ResultadoDiario> {
  const r: ResultadoDiario = { lembretes: 0, falhas: 0, prazos: 0, resumos: 0, push: 0 };
  const gmails = new Map<string, Gmail | null>();

  // ---------- 1) Lembretes de prazo para os alunos ----------
  const { data: turmas } = await admin
    .from("turmas")
    .select("id, nome, org_id, caixa_token, moodle_conta, lembrete_abre, lembrete_dois_dias, lembrete_no_dia, lembrete_por, organizacoes(nome, slug, vocabulario, etiqueta_assunto, ativa)")
    .eq("arquivada", false)
    .not("lembrete_por", "is", null)
    .or("lembrete_abre.eq.true,lembrete_dois_dias.eq.true,lembrete_no_dia.eq.true");
  for (const t of turmas ?? []) {
    const org = t.organizacoes as unknown as { nome: string; slug: string; vocabulario: Vocabulario; etiqueta_assunto: string; ativa: boolean } | null;
    if (!org?.ativa) continue;
    const { data: etapas } = await admin.from("etapas").select("id, numero, titulo, recebe_de, recebe_ate, entregaveis").eq("turma_id", t.id);
    const deHoje = (etapas ?? []).flatMap((e) => diasDosLembretes(e, t).filter((x) => x.dia === hoje).map((x) => ({ tipo: x.tipo, etapa: e })));
    if (!deHoje.length) continue;
    const gmail = await abrirGmail(admin, t.lembrete_por as string, gmails);
    if (!gmail) continue;
    const vc = completarVocabulario(org.vocabulario);
    const { data: grupos } = await admin
      .from("grupos")
      .select("id, nome, integrantes(email)")
      .eq("turma_id", t.id)
      .eq("ativo", true)
      .eq("escondido", false);
    const endereco = t.moodle_conta ? null : enderecoDeRecebimento(t.caixa_token);
    for (const { tipo, etapa } of deHoje) {
      const { data: entregas } = await admin.from("entregas").select("grupo_id").eq("etapa_id", etapa.id);
      const entregou = new Set((entregas ?? []).map((x) => x.grupo_id as string));
      for (const g of grupos ?? []) {
        const para = (g.integrantes as { email: string }[]).map((i) => i.email);
        if (!para.length || (tipo !== "abre" && entregou.has(g.id))) continue;
        // Reserva antes de enviar: nunca manda o mesmo lembrete duas vezes.
        const { data: reservou } = await admin
          .from("lembretes_enviados")
          .upsert({ etapa_id: etapa.id, grupo_id: g.id, tipo }, { onConflict: "etapa_id,grupo_id,tipo", ignoreDuplicates: true })
          .select("etapa_id");
        if (!reservou?.length) continue;
        try {
          const msg = montarAviso(gmail.de, textoDoLembrete(tipo, { etapa, grupo: g.nome, turma: t.nome, vc, endereco, etiqueta: org.etiqueta_assunto, moodle: Boolean(t.moodle_conta), para, site }));
          await enviarPeloGmail(gmail.acesso, msg.raw);
          r.lembretes++;
        } catch (e) {
          r.falhas++;
          await admin
            .from("lembretes_enviados")
            .update({ ok: false, erro: (e instanceof Error ? e.message : String(e)).slice(0, 300) })
            .match({ etapa_id: etapa.id, grupo_id: g.id, tipo });
        }
      }
    }
  }

  // ---------- 2) Aviso de prazo amanhã para quem avalia ----------
  const amanha = somarDias(hoje, 1);
  const { data: vencem } = await admin
    .from("etapas")
    .select("id, numero, titulo, org_id, turma_id, organizacoes(slug, vocabulario, ativa), turmas(arquivada)")
    .eq("recebe_ate", amanha);
  for (const e of vencem ?? []) {
    const org = e.organizacoes as unknown as { slug: string; vocabulario: Vocabulario; ativa: boolean } | null;
    if (!org?.ativa || (e.turmas as unknown as { arquivada: boolean } | null)?.arquivada) continue;
    const link = `/app/${org.slug}/entregas?etapa=${e.id}`;
    const { count: ja } = await admin.from("avisos").select("id", { count: "exact", head: true }).eq("tipo", "prazo").eq("link", link);
    if (ja) continue;
    const [{ data: grupos }, { data: entregas }] = await Promise.all([
      admin.from("grupos").select("id, nome").eq("turma_id", e.turma_id).eq("ativo", true).eq("escondido", false).order("nome"),
      admin.from("entregas").select("grupo_id").eq("etapa_id", e.id),
    ]);
    const entregou = new Set((entregas ?? []).map((x) => x.grupo_id as string));
    const faltam = (grupos ?? []).filter((g) => !entregou.has(g.id)).map((g) => g.nome as string);
    const vc = completarVocabulario(org.vocabulario);
    await admin.rpc("avisar_equipe", {
      p_org: e.org_id,
      p_tipo: "prazo",
      p_titulo: `Prazo amanhã: ${vc.etapa} ${e.numero} · ${e.titulo}`,
      p_texto: faltam.length ? `Faltam ${faltam.length}: ${faltam.slice(0, 6).join(", ")}${faltam.length > 6 ? "…" : ""}` : "Todos já entregaram.",
      p_link: link,
      p_menos: null,
    });
    r.prazos++;
  }

  // ---------- 3) Resumo do dia por e-mail (do próprio Gmail para a pessoa) ----------
  const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: novos } = await admin.from("avisos").select("user_id, tipo, titulo, texto").is("lido_em", null).gt("criado_em", desde).order("id", { ascending: false });
  const porPessoa = new Map<string, { tipo: string; titulo: string; texto: string }[]>();
  for (const a of novos ?? []) porPessoa.set(a.user_id, [...(porPessoa.get(a.user_id) ?? []), a]);
  if (porPessoa.size) {
    const ids = [...porPessoa.keys()];
    const { data: prefs } = await admin.from("preferencias_avisos").select("user_id, resumo_email").in("user_id", ids);
    const nao = new Set((prefs ?? []).filter((p) => !p.resumo_email).map((p) => p.user_id as string));
    for (const [uid, lista] of porPessoa) {
      if (nao.has(uid)) continue;
      const gmail = await abrirGmail(admin, uid, gmails);
      if (!gmail) continue;
      const { data: u } = await admin.auth.admin.getUserById(uid);
      const destino = u?.user?.email;
      if (!destino) continue;
      const { data: reservou } = await admin.from("resumos_enviados").upsert({ user_id: uid, dia: hoje }, { onConflict: "user_id,dia", ignoreDuplicates: true }).select("dia");
      if (!reservou?.length) continue;
      const conta = (t: string) => lista.filter((a) => a.tipo === t).length;
      const partes = [
        conta("entrega") && `${conta("entrega")} ${conta("entrega") === 1 ? "entrega nova" : "entregas novas"}`,
        conta("ia") && `${conta("ia")} para revisar`,
        conta("atraso") && `${conta("atraso")} com atraso`,
        conta("prazo") && `${conta("prazo")} ${conta("prazo") === 1 ? "prazo chegando" : "prazos chegando"}`,
        conta("enviada") && `${conta("enviada")} ${conta("enviada") === 1 ? "devolutiva enviada" : "devolutivas enviadas"} por colegas`,
      ].filter(Boolean) as string[];
      try {
        const msg = montarAviso(gmail.de, {
          para: [destino],
          assunto: `Seu dia no Handback: ${partes[0] ?? `${lista.length} avisos`}`,
          titulo: "Bom dia! Desde ontem no Handback:",
          paragrafos: [
            partes.join(" · "),
            ...lista.slice(0, 8).map((a) => `• ${a.titulo}${a.texto ? ` — ${a.texto}` : ""}`),
            ...(lista.length > 8 ? [`E mais ${lista.length - 8} no sininho do app.`] : []),
            `Abrir o Handback: ${site}/app`,
            "Não quer mais este resumo? Desligue em Minha conta › Meus avisos.",
          ],
          site,
        });
        await enviarPeloGmail(gmail.acesso, msg.raw);
        r.resumos++;
      } catch {
        await admin.from("resumos_enviados").delete().match({ user_id: uid, dia: hoje });
      }
    }
  }

  r.push = await despacharPush(admin, site).catch(() => 0);
  return r;
}

function textoDoLembrete(
  tipo: TipoLembrete,
  d: {
    etapa: { numero: number; titulo: string; recebe_ate: string | null; entregaveis: string[] };
    grupo: string;
    turma: string;
    vc: ReturnType<typeof completarVocabulario>;
    endereco: string | null;
    etiqueta: string;
    moodle: boolean;
    para: string[];
    site: string;
  },
) {
  const nomeEtapa = `${d.vc.etapa} ${d.etapa.numero} · ${d.etapa.titulo}`;
  const prazo = d.etapa.recebe_ate ? `${diaPorExtenso(d.etapa.recebe_ate)} (${ddmm(d.etapa.recebe_ate)})` : "";
  const assunto =
    tipo === "abre"
      ? `Já pode entregar: ${nomeEtapa}`
      : tipo === "no_dia"
        ? `Lembrete: ${nomeEtapa} vence hoje`
        : `Lembrete: ${nomeEtapa} vence ${d.etapa.recebe_ate ? diaPorExtenso(d.etapa.recebe_ate).split(",")[0] : "em 2 dias"}${d.etapa.recebe_ate ? ` (${ddmm(d.etapa.recebe_ate)})` : ""}`;
  const abertura =
    tipo === "abre"
      ? `Olá, ${d.grupo}! ${nomeEtapa} já está aberta para entregas${prazo ? `, até ${prazo}` : ""}.`
      : tipo === "no_dia"
        ? `Olá, ${d.grupo}! O prazo de ${nomeEtapa} é hoje. Ainda não recebemos a entrega de vocês.`
        : `Olá, ${d.grupo}! O prazo de ${nomeEtapa} é ${prazo}. Ainda não recebemos a entrega de vocês.`;
  const como = d.moodle
    ? "Como entregar: pela tarefa no Moodle, como de costume."
    : d.endereco
      ? `Como entregar: mande um e-mail para ${d.endereco} com os arquivos ou links, com [${d.etiqueta}] no assunto.`
      : `Como entregar: responda este e-mail com os arquivos ou links, com [${d.etiqueta}] no assunto.`;
  return {
    para: d.para,
    assunto,
    titulo: nomeEtapa,
    site: d.site,
    paragrafos: [
      abertura,
      ...(d.etapa.entregaveis.length ? ["O que entregar:", ...d.etapa.entregaveis.map((x) => `• ${x}`)] : []),
      como,
      ...(tipo === "abre" ? [] : ["Se vocês já entregaram por outro caminho, pode ignorar este e-mail."]),
      `${d.turma}`,
    ],
  };
}

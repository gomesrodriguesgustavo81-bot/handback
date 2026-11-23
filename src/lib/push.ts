import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { cifrarTexto, criptoPronta, decifrarTexto } from "./cripto";

/**
 * Notificações no celular (Web Push). As chaves do Handback são criadas
 * sozinhas na primeira vez e guardadas no banco (a privada, cifrada).
 */
async function chaves(admin: SupabaseClient): Promise<{ publica: string; privada: string } | null> {
  if (!criptoPronta()) return null;
  const ler = async () => {
    const { data } = await admin.from("config_plataforma").select("chave, valor").in("chave", ["vapid_publica", "vapid_privada"]);
    const m = new Map((data ?? []).map((x) => [x.chave as string, x.valor as string]));
    const privada = m.get("vapid_privada");
    const aberta = privada ? decifrarTexto(privada) : null;
    return m.get("vapid_publica") && aberta ? { publica: m.get("vapid_publica")!, privada: aberta } : null;
  };
  const ja = await ler();
  if (ja) return ja;
  const novas = webpush.generateVAPIDKeys();
  // Se dois pedidos criarem ao mesmo tempo, vale o primeiro que gravou.
  await admin.from("config_plataforma").upsert(
    [
      { chave: "vapid_publica", valor: novas.publicKey },
      { chave: "vapid_privada", valor: cifrarTexto(novas.privateKey) },
    ],
    { onConflict: "chave", ignoreDuplicates: true },
  );
  return ler();
}

export async function chavePublicaPush(admin: SupabaseClient): Promise<string | null> {
  return (await chaves(admin))?.publica ?? null;
}

/** Manda para o celular os avisos novos de quem ligou a notificação. Chamado depois de cada novidade. */
export async function despacharPush(admin: SupabaseClient | null, site = ""): Promise<number> {
  if (!admin) return 0;
  const { data: pendentes } = await admin
    .from("avisos")
    .select("id, user_id, titulo, texto, link")
    .is("push_em", null)
    .gt("criado_em", new Date(Date.now() - 6 * 3600_000).toISOString())
    .order("id")
    .limit(200);
  if (!pendentes?.length) return 0;
  await admin.from("avisos").update({ push_em: new Date().toISOString() }).in("id", pendentes.map((p) => p.id));

  const usuarios = [...new Set(pendentes.map((p) => p.user_id as string))];
  const [{ data: prefs }, { data: aparelhos }] = await Promise.all([
    admin.from("preferencias_avisos").select("user_id, celular").in("user_id", usuarios).eq("celular", true),
    admin.from("aparelhos_push").select("id, user_id, endpoint, p256dh, auth").in("user_id", usuarios),
  ]);
  const querem = new Set((prefs ?? []).map((p) => p.user_id as string));
  const alvos = (aparelhos ?? []).filter((a) => querem.has(a.user_id as string));
  if (!alvos.length) return 0;
  const k = await chaves(admin);
  if (!k) return 0;
  const contato = site && /^https:\/\//.test(site) ? site : "https://handback.app";

  let enviados = 0;
  for (const a of alvos) {
    for (const p of pendentes.filter((x) => x.user_id === a.user_id)) {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint as string, keys: { p256dh: a.p256dh as string, auth: a.auth as string } },
          JSON.stringify({ titulo: p.titulo, texto: p.texto, link: p.link }),
          { vapidDetails: { subject: contato, publicKey: k.publica, privateKey: k.privada }, TTL: 3600 * 12 },
        );
        enviados++;
      } catch (e) {
        const codigo = (e as { statusCode?: number }).statusCode;
        // Aparelho desinscrito ou trocado: esquece.
        if (codigo === 404 || codigo === 410) await admin.from("aparelhos_push").delete().eq("id", a.id);
      }
    }
  }
  return enviados;
}

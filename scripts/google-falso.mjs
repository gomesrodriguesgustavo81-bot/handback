// "Google de mentira" para testes do envio pelo Gmail:
//  - tela de permissão (/o/oauth2/v2/auth) que aprova na hora e volta com um código;
//  - troca de código e renovação de token (/token), revogação (/revoke);
//  - envio de mensagem (/gmail/v1/users/me/messages/send), que só registra o e-mail;
//  - Google Agenda (/calendar/v3): cria agendas e eventos em memória (GET /__agenda mostra tudo).
// Uso: node scripts/google-falso.mjs [porta] [arquivo-de-registro]
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const porta = Number(process.argv[2] ?? 4556);
const registro = process.argv[3];
const CLIENTE = "cliente-teste";
const SEGREDO = "segredo-teste";
const ESCOPO = "https://www.googleapis.com/auth/gmail.send";
const ESCOPOS = [ESCOPO, "https://www.googleapis.com/auth/calendar.app.created", "https://www.googleapis.com/auth/drive.file"];
const codigos = new Map(); // código → { redirect_uri, escopo }
const agendas = new Map(); // id → { summary, eventos: Map(id → evento), envios: [] }
const renovacoes = new Set();
const acessos = new Set();

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const idToken = (email) => `${b64({ alg: "none" })}.${b64({ email, email_verified: true })}.x`;

createServer(async (req, res) => {
  let corpo = "";
  for await (const parte of req) corpo += parte;
  const url = new URL(req.url, `http://127.0.0.1:${porta}`);
  const json = (status, j) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(j));
  };

  if (url.pathname === "/o/oauth2/v2/auth") {
    const p = url.searchParams;
    const escopo = ESCOPOS.find((e) => p.get("scope")?.split(" ").includes(e));
    if (p.get("client_id") !== CLIENTE || !escopo || p.get("access_type") !== "offline") {
      return json(400, { error: "pedido de permissão errado" });
    }
    const volta = new URL(p.get("redirect_uri"));
    if (p.get("login_hint")?.startsWith("nega")) volta.searchParams.set("error", "access_denied");
    else {
      const codigo = randomBytes(8).toString("hex");
      codigos.set(codigo, { volta: p.get("redirect_uri"), escopo });
      volta.searchParams.set("code", codigo);
    }
    volta.searchParams.set("state", p.get("state"));
    res.writeHead(302, { location: volta.toString() });
    return res.end();
  }

  const form = new URLSearchParams(corpo);
  if (url.pathname === "/token") {
    if (form.get("client_id") !== CLIENTE || form.get("client_secret") !== SEGREDO) return json(401, { error: "invalid_client" });
    if (form.get("grant_type") === "authorization_code") {
      const codigo = form.get("code");
      const pedido = codigos.get(codigo);
      if (pedido?.volta !== form.get("redirect_uri")) return json(400, { error: "invalid_grant" });
      codigos.delete(codigo);
      const renova = `renova-${randomBytes(6).toString("hex")}`;
      renovacoes.add(renova);
      return json(200, { access_token: "x", refresh_token: renova, scope: `openid email ${pedido.escopo}`, id_token: idToken("professora@gmail.test") });
    }
    if (form.get("grant_type") === "refresh_token") {
      if (!renovacoes.has(form.get("refresh_token"))) return json(400, { error: "invalid_grant" });
      const acesso = `acesso-${randomBytes(6).toString("hex")}`;
      acessos.add(acesso);
      return json(200, { access_token: acesso, expires_in: 3600 });
    }
    return json(400, { error: "unsupported_grant_type" });
  }

  if (url.pathname === "/revoke") {
    renovacoes.delete(form.get("token"));
    return json(200, {});
  }

  if (url.pathname === "/gmail/v1/users/me/messages/send") {
    const acesso = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!acessos.has(acesso)) return json(401, { error: { message: "Invalid Credentials" } });
    const raw = JSON.parse(corpo).raw;
    const texto = Buffer.from(raw, "base64url").toString("utf8");
    const cab = texto.split("\r\n\r\n")[0];
    const fronteira = cab.match(/boundary="([^"]+)"/)?.[1];
    const partes = (fronteira ? texto.split(`--${fronteira}`).slice(1, -1) : [texto.slice(cab.length)]).map((p) => {
      const [c, corpo = ""] = p.replace(/^\r\n/, "").split("\r\n\r\n");
      return { tipo: c.match(/Content-Type: ([^;\r\n]+)/)?.[1] ?? "text/plain", conteudo: Buffer.from(corpo.replace(/\r\n/g, ""), "base64").toString("utf8") };
    });
    const id = `msg-${randomBytes(6).toString("hex")}`;
    if (registro) {
      appendFileSync(
        registro,
        JSON.stringify({
          id,
          cabecalho: cab,
          texto: partes.find((x) => x.tipo === "text/plain")?.conteudo ?? "",
          html: partes.find((x) => x.tipo === "text/html")?.conteudo ?? "",
        }) + "\n",
      );
    }
    return json(200, { id, threadId: id });
  }
  if (url.pathname === "/__agenda") {
    return json(200, Object.fromEntries([...agendas].map(([id, a]) => [id, { summary: a.summary, eventos: Object.fromEntries(a.eventos), envios: a.envios }])));
  }
  const cal = url.pathname.match(/^\/calendar\/v3\/calendars(?:\/([^/]+))?(?:\/events(?:\/([^/]+))?)?$/);
  if (cal) {
    const acesso = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!acessos.has(acesso)) return json(401, { error: { message: "Invalid Credentials" } });
    const [, agId, evId] = cal.map((x) => (x ? decodeURIComponent(x) : x));
    const temEventos = url.pathname.includes("/events");
    if (!agId && req.method === "POST") {
      const id = `agenda-${randomBytes(4).toString("hex")}@group.calendar.google.com`;
      agendas.set(id, { summary: JSON.parse(corpo).summary, eventos: new Map(), envios: [] });
      return json(200, { id });
    }
    const ag = agendas.get(agId);
    if (!ag) return json(404, { error: { message: "Not Found" } });
    if (!temEventos && req.method === "DELETE") {
      agendas.delete(agId);
      res.writeHead(204);
      return res.end();
    }
    const avisar = url.searchParams.get("sendUpdates") ?? "none";
    if (temEventos && !evId && req.method === "POST") {
      const id = `ev${randomBytes(4).toString("hex")}`;
      const ev = JSON.parse(corpo);
      ag.eventos.set(id, ev);
      if (avisar === "all") ag.envios.push({ id, para: (ev.attendees ?? []).map((a) => a.email) });
      return json(200, { id });
    }
    if (evId && !ag.eventos.has(evId)) return json(404, { error: { message: "Not Found" } });
    if (evId && req.method === "PUT") {
      const ev = JSON.parse(corpo);
      ag.eventos.set(evId, ev);
      if (avisar === "all" && ev.attendees?.length) ag.envios.push({ id: evId, para: ev.attendees.map((x) => x.email) });
      return json(200, { id: evId });
    }
    if (evId && req.method === "DELETE") {
      ag.eventos.delete(evId);
      res.writeHead(204);
      return res.end();
    }
  }
  json(404, { error: "rota desconhecida" });
}).listen(porta, "127.0.0.1", () => console.log(`Google de mentira em http://127.0.0.1:${porta}`));

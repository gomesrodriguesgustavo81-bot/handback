// "Google de mentira" para testes do envio pelo Gmail:
//  - tela de permissão (/o/oauth2/v2/auth) que aprova na hora e volta com um código;
//  - troca de código e renovação de token (/token), revogação (/revoke);
//  - envio de mensagem (/gmail/v1/users/me/messages/send), que só registra o e-mail.
// Uso: node scripts/google-falso.mjs [porta] [arquivo-de-registro]
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const porta = Number(process.argv[2] ?? 4556);
const registro = process.argv[3];
const CLIENTE = "cliente-teste";
const SEGREDO = "segredo-teste";
const ESCOPO = "https://www.googleapis.com/auth/gmail.send";
const codigos = new Map(); // código → redirect_uri
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
    if (p.get("client_id") !== CLIENTE || !p.get("scope")?.includes(ESCOPO) || p.get("access_type") !== "offline") {
      return json(400, { error: "pedido de permissão errado" });
    }
    const volta = new URL(p.get("redirect_uri"));
    if (p.get("login_hint")?.startsWith("nega")) volta.searchParams.set("error", "access_denied");
    else {
      const codigo = randomBytes(8).toString("hex");
      codigos.set(codigo, p.get("redirect_uri"));
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
      if (codigos.get(codigo) !== form.get("redirect_uri")) return json(400, { error: "invalid_grant" });
      codigos.delete(codigo);
      const renova = `renova-${randomBytes(6).toString("hex")}`;
      renovacoes.add(renova);
      return json(200, { access_token: "x", refresh_token: renova, scope: `openid email ${ESCOPO}`, id_token: idToken("professora@gmail.test") });
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
  json(404, { error: "rota desconhecida" });
}).listen(porta, "127.0.0.1", () => console.log(`Google de mentira em http://127.0.0.1:${porta}`));

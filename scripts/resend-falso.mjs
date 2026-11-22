// "Resend de mentira" para testes do recebimento:
//  - POST /__emails  (só para o teste) guarda um e-mail { id, from, to, subject, text, headers, anexos: [{ filename, content_type, conteudo }] }
//  - GET /emails/receiving/:id e /emails/receiving/:id/attachments, como a API do Resend
//  - GET /download/:id/:n devolve o arquivo
// Uso: node scripts/resend-falso.mjs [porta]
import { createServer } from "node:http";

const porta = Number(process.argv[2] ?? 4557);
const emails = new Map();

createServer(async (req, res) => {
  let corpo = "";
  for await (const parte of req) corpo += parte;
  const json = (status, j) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(j));
  };
  const url = new URL(req.url, `http://127.0.0.1:${porta}`);
  if (req.method === "POST" && url.pathname === "/__emails") {
    const e = JSON.parse(corpo);
    emails.set(e.id, e);
    return json(200, { ok: true });
  }
  const baixar = url.pathname.match(/^\/download\/([^/]+)\/(\d+)$/);
  if (baixar) {
    const a = emails.get(baixar[1])?.anexos?.[Number(baixar[2])];
    if (!a) return json(404, {});
    res.writeHead(200, { "content-type": a.content_type });
    return res.end(Buffer.from(a.conteudo));
  }
  if (req.headers.authorization !== "Bearer re_teste") return json(401, { message: "API key is invalid" });
  const m = url.pathname.match(/^\/emails\/receiving\/([^/]+)(\/attachments)?$/);
  const e = m && emails.get(m[1]);
  if (!e) return json(404, { message: "not found" });
  const anexos = (e.anexos ?? []).map((a, i) => ({
    id: `at_${i}`,
    filename: a.filename,
    content_type: a.content_type,
    size: a.conteudo.length,
    download_url: `http://127.0.0.1:${porta}/download/${e.id}/${i}`,
  }));
  if (m[2]) return json(200, { object: "list", data: anexos });
  const { anexos: _x, ...resto } = e;
  return json(200, { object: "email", created_at: new Date().toISOString(), html: "", ...resto, attachments: anexos.map(({ download_url: _d, ...a }) => a) });
}).listen(porta, "127.0.0.1", () => console.log(`Resend de mentira em http://127.0.0.1:${porta}`));

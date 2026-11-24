// "Google de mentira" para testes do envio pelo Gmail:
//  - tela de permissão (/o/oauth2/v2/auth) que aprova na hora e volta com um código;
//  - troca de código e renovação de token (/token), revogação (/revoke);
//  - envio de mensagem (/gmail/v1/users/me/messages/send), que só registra o e-mail;
//  - Google Agenda (/calendar/v3): cria agendas e eventos em memória (GET /__agenda mostra tudo).
//  - Google Classroom (/classroom/v1): turmas, alunos, tarefas e envios em memória
//    (GET /__classroom mostra tudo; POST /__classroom/entregar faz um aluno entregar).
// Uso: node scripts/google-falso.mjs [porta] [arquivo-de-registro]
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const porta = Number(process.argv[2] ?? 4556);
const registro = process.argv[3];
const CLIENTE = "cliente-teste";
const SEGREDO = "segredo-teste";
const ESCOPO = "https://www.googleapis.com/auth/gmail.send";
const ESCOPOS = [
  ESCOPO,
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.profile.emails",
  "https://www.googleapis.com/auth/classroom.coursework.students",
];
const codigos = new Map(); // código → { redirect_uri, escopo }
const agendas = new Map(); // id → { summary, eventos: Map(id → evento), envios: [] }
const drive = new Map(); // id → { name, parents, mimeType, dados: Buffer }
const renovacoes = new Set();

// Classroom de mentira: uma turma com 3 alunos e uma tarefa criada à mão pelo professor.
let proximoId = 900;
const cursos = new Map([
  [
    "111",
    {
      name: "Cálculo I",
      section: "Turma 2026",
      alunos: [
        { id: "u1", nome: "Ana Souza", email: "ana.souza@aluno.test" },
        { id: "u2", nome: "Bruno Lima", email: "bruno.lima@aluno.test" },
        { id: "u3", nome: "Carla Dias", email: "carla.dias@aluno.test" },
      ],
      tarefas: new Map([
        [
          "501",
          {
            id: "501",
            title: "Lista 1 · Limites",
            description: "Resolver os exercícios 1 a 10.",
            workType: "ASSIGNMENT",
            state: "PUBLISHED",
            maxPoints: 10,
            dueDate: { year: 2099, month: 3, day: 10 },
            dueTime: { hours: 2, minutes: 59 },
            alternateLink: "https://classroom.google.com/c/x/a/501",
            associatedWithDeveloper: false,
            creationTime: "2026-01-01T00:00:00Z",
            envios: new Map(),
          },
        ],
      ]),
    },
  ],
  ["222", { name: "Cálculo II", section: "", alunos: [], tarefas: new Map() }],
]);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\nBT (Resolucao da lista de limites do aluno) Tj ET\n%%EOF\n", "latin1");
function entregar(cursoId, tarefaId, aluno, { arquivo, link, texto } = {}) {
  const t = cursos.get(cursoId).tarefas.get(tarefaId);
  const id = `env-${tarefaId}-${aluno}`;
  const anexos = [];
  if (arquivo) {
    const arq = `drv${randomBytes(4).toString("hex")}`;
    drive.set(arq, { name: arquivo, parents: [], mimeType: "application/pdf", dados: PDF });
    anexos.push({ driveFile: { id: arq, title: arquivo, alternateLink: `https://drive.google.com/file/d/${arq}` } });
  }
  if (link) anexos.push({ link: { url: link, title: "link" } });
  const agora = new Date().toISOString();
  t.envios.set(id, {
    id,
    userId: aluno,
    state: "TURNED_IN",
    creationTime: agora,
    updateTime: agora,
    assignmentSubmission: { attachments: anexos },
    ...(texto ? { shortAnswerSubmission: { answer: texto } } : {}),
    submissionHistory: [{ stateHistory: { state: "CREATED", stateTimestamp: agora } }, { stateHistory: { state: "TURNED_IN", stateTimestamp: agora } }],
  });
}
entregar("111", "501", "u1", { arquivo: "Ana - Lista 1.pdf" });
entregar("111", "501", "u2", { link: "https://www.youtube.com/watch?v=bruno123" });
const acessos = new Set();

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const idToken = (email) => `${b64({ alg: "none" })}.${b64({ email, email_verified: true })}.x`;

createServer(async (req, res) => {
  const pedacos = [];
  for await (const parte of req) pedacos.push(parte);
  const bruto = Buffer.concat(pedacos);
  // Upload do Drive vem em bytes; o resto é texto.
  const corpo = String(req.url).startsWith("/upload/") ? bruto.toString("latin1") : bruto.toString("utf8");
  const url = new URL(req.url, `http://127.0.0.1:${porta}`);
  const json = (status, j) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(j));
  };

  if (url.pathname === "/o/oauth2/v2/auth") {
    const p = url.searchParams;
    const pedidos = ESCOPOS.filter((e) => p.get("scope")?.split(" ").includes(e));
    // "sem-classroom" na dica: a pessoa desmarca a permissão das notas na tela do Google.
    const escopo = (p.get("login_hint")?.startsWith("sem-classroom") ? pedidos.filter((e) => !e.includes("coursework")) : pedidos).join(" ");
    if (p.get("client_id") !== CLIENTE || !pedidos.length || p.get("access_type") !== "offline") {
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
  if (url.pathname === "/__drive") {
    if (url.searchParams.get("apagar")) drive.delete(url.searchParams.get("apagar"));
    return json(200, Object.fromEntries([...drive].map(([id, f]) => [id, { name: f.name, parents: f.parents, mimeType: f.mimeType, tamanho: f.dados?.length ?? 0 }])));
  }
  if (url.pathname.startsWith("/drive/v3/files") || url.pathname.startsWith("/upload/drive/v3/files")) {
    const acesso = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!acessos.has(acesso)) return json(401, { error: { message: "Invalid Credentials" } });
    const id = decodeURIComponent(url.pathname.split("/files/")[1] ?? "");
    if (req.method === "POST" && url.pathname.startsWith("/upload/")) {
      const fronteira = String(req.headers["content-type"]).match(/boundary=([^;]+)/)?.[1];
      const bruto = Buffer.from(corpo, "latin1");
      const partes = bruto.toString("latin1").split(`--${fronteira}`).slice(1, -1);
      const meta = JSON.parse(Buffer.from(partes[0].split("\r\n\r\n")[1].trim(), "latin1").toString("utf8"));
      const conteudo = partes[1].slice(partes[1].indexOf("\r\n\r\n") + 4).replace(/\r\n$/, "");
      const pai = meta.parents?.[0];
      if (!drive.has(pai)) return json(404, { error: { message: "File not found: parent" } });
      const novo = `arq${randomBytes(4).toString("hex")}`;
      drive.set(novo, { name: meta.name, parents: meta.parents, mimeType: partes[1].match(/Content-Type: ([^\r\n]+)/)?.[1], dados: Buffer.from(conteudo, "latin1") });
      return json(200, { id: novo });
    }
    if (req.method === "POST") {
      const meta = JSON.parse(corpo);
      if (meta.parents?.[0] && !drive.has(meta.parents[0])) return json(404, { error: { message: "File not found: parent" } });
      const novo = `pasta${randomBytes(4).toString("hex")}`;
      drive.set(novo, { name: meta.name, parents: meta.parents ?? [], mimeType: meta.mimeType });
      return json(200, { id: novo });
    }
    const f = drive.get(id);
    if (!f) return json(404, { error: { message: "File not found" } });
    if (req.method === "GET" && url.searchParams.get("alt") === "media") {
      res.writeHead(200, { "content-type": f.mimeType ?? "application/octet-stream" });
      return res.end(f.dados ?? Buffer.alloc(0));
    }
    if (req.method === "GET") return json(200, { id, trashed: false, name: f.name, mimeType: f.mimeType, size: String(f.dados?.length ?? 0) });
    if (req.method === "DELETE") {
      drive.delete(id);
      res.writeHead(204);
      return res.end();
    }
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
  if (url.pathname === "/__classroom" && req.method === "GET") {
    return json(200, Object.fromEntries([...cursos].map(([id, c]) => [id, { ...c, tarefas: Object.fromEntries([...c.tarefas].map(([tid, t]) => [tid, { ...t, envios: Object.fromEntries(t.envios) }])) }])));
  }
  if (url.pathname === "/__classroom/entregar" && req.method === "POST") {
    const { curso, tarefa, aluno, arquivo, link, texto } = JSON.parse(corpo);
    entregar(curso, tarefa, aluno, { arquivo, link, texto });
    return json(200, {});
  }
  const cr = url.pathname.match(/^\/classroom\/v1\/courses(?:\/([^/]+))?(?:\/(students|courseWork)(?:\/([^/]+))?(?:\/studentSubmissions(?:\/([^/:]+))?(:return)?)?)?$/);
  if (cr) {
    const acesso = (req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (!acessos.has(acesso)) return json(401, { error: { message: "Invalid Credentials" } });
    const [, cursoId, parte, tarefaId, envioId, devolver] = cr;
    if (!cursoId) return json(200, { courses: [...cursos].map(([id, c]) => ({ id, name: c.name, section: c.section })) });
    const c = cursos.get(cursoId);
    if (!c) return json(404, { error: { message: "Requested entity was not found." } });
    if (!parte) return json(200, { id: cursoId, name: c.name, section: c.section });
    if (parte === "students") {
      return json(200, { students: c.alunos.map((a) => ({ userId: a.id, profile: { name: { fullName: a.nome }, emailAddress: a.email } })) });
    }
    if (!tarefaId && req.method === "POST") {
      const b = JSON.parse(corpo);
      const id = String(++proximoId);
      c.tarefas.set(id, { ...b, id, associatedWithDeveloper: true, alternateLink: `https://classroom.google.com/c/x/a/${id}`, creationTime: new Date().toISOString(), envios: new Map() });
      const { envios: _e, ...t } = c.tarefas.get(id); void _e;
      return json(200, t);
    }
    if (!tarefaId) return json(200, { courseWork: [...c.tarefas.values()].map((x) => ({ ...x, envios: undefined })) });
    const t = c.tarefas.get(tarefaId);
    if (!t) return json(404, { error: { message: "Requested entity was not found." } });
    if (!envioId && req.method === "DELETE") {
      if (!t.associatedWithDeveloper) return json(403, { error: { message: "@ProjectPermissionDenied The Developer Project is not permitted to make this request.", status: "PERMISSION_DENIED" } });
      c.tarefas.delete(tarefaId);
      return json(200, {});
    }
    if (!envioId) {
      const estados = url.searchParams.getAll("states");
      return json(200, { studentSubmissions: [...t.envios.values()].filter((e) => !estados.length || estados.includes(e.state)) });
    }
    const e = t.envios.get(envioId);
    if (!e) return json(404, { error: { message: "Requested entity was not found." } });
    if (!t.associatedWithDeveloper) return json(403, { error: { message: "@ProjectPermissionDenied The Developer Project is not permitted to make this request.", status: "PERMISSION_DENIED" } });
    if (req.method === "PATCH") {
      const b = JSON.parse(corpo);
      for (const campo of (url.searchParams.get("updateMask") ?? "").split(",")) if (campo in b) e[campo] = b[campo];
      return json(200, e);
    }
    if (devolver && req.method === "POST") {
      e.state = "RETURNED";
      return json(200, {});
    }
  }
  json(404, { error: "rota desconhecida" });
}).listen(porta, "127.0.0.1", () => console.log(`Google de mentira em http://127.0.0.1:${porta}`));

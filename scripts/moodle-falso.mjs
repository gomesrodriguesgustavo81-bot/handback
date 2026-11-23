// "Moodle de mentira" para testes da ligação com o Moodle (serviço de aplicativos):
//  - POST /login/token.php (usuário prof.moodle, senha "senha moodle") → chave
//  - POST /webservice/rest/server.php?wsfunction=… com as funções que o Handback usa
//  - GET /webservice/pluginfile.php/… devolve o arquivo (só com a chave)
//  - POST /__envio (só para o teste) acrescenta um envio de aluno
// Cada mod_assign_save_grade é anotado no arquivo de registro (uma linha JSON).
// Uso: node scripts/moodle-falso.mjs [porta] [arquivo-de-registro]
import { appendFileSync } from "node:fs";
import { createServer } from "node:http";

const porta = Number(process.argv[2] ?? 4558);
const registro = process.argv[3];
const CHAVE = "chavemoodle0123456789abcdef";
const BASE = `http://127.0.0.1:${porta}`;
const agora = () => Math.floor(Date.now() / 1000);
const umDia = 24 * 60 * 60;

const FUNCOES = [
  "core_webservice_get_site_info",
  "core_enrol_get_users_courses",
  "core_enrol_get_enrolled_users",
  "mod_assign_get_assignments",
  "mod_assign_get_submissions",
  "mod_assign_get_grades",
  "mod_assign_save_grade",
].map((name) => ({ name }));

const azul = { id: 12, name: "Grupo Azul" };
const verde = { id: 13, name: "Grupo Verde" };
const aluno = [{ shortname: "student" }];
const PESSOAS = [
  { id: 2, fullname: "Marina Teixeira", email: "marina@ava.test", roles: [{ shortname: "editingteacher" }], groups: [] },
  { id: 101, fullname: "Ana Souza", email: "ana.souza@aluno.test", idnumber: "2026-0312", roles: aluno, groups: [azul] },
  { id: 102, fullname: "Bruno Lima", email: "bruno.lima@aluno.test", username: "11223344", roles: aluno, groups: [azul] },
  { id: 103, fullname: "Carla Dias", email: "carla.dias@aluno.test", roles: aluno, groups: [verde] },
  { id: 104, fullname: "Diego Rocha", roles: aluno, groups: [] }, // e-mail escondido pelo Moodle
];
const TAREFAS = [
  { id: 901, cmid: 31, name: "Protótipo navegável", intro: "<p>Entregue o <b>link do Figma</b> e o relatório.</p>", duedate: agora() + 7 * umDia, allowsubmissionsfromdate: agora() - 7 * umDia, teamsubmission: 1, grade: 10 },
  { id: 902, cmid: 32, name: "Fórum de apresentação", intro: "", duedate: 0, teamsubmission: 0, grade: 0 },
];
const ENVIOS = {
  901: [
    {
      id: 7001, userid: 0, groupid: 12, status: "submitted", timemodified: agora() - 3600,
      plugins: [
        { type: "file", fileareas: [{ area: "submission_files", files: [{ filename: "relatório do grupo.pdf", filesize: 20, mimetype: "application/pdf", fileurl: `${BASE}/webservice/pluginfile.php/9/assignsubmission_file/submission_files/7001/relatorio.pdf` }] }] },
        { type: "onlinetext", editorfields: [{ name: "onlinetext", text: "<p>Link do protótipo: https://figma.com/proto/azul</p>" }] },
      ],
    },
    { id: 7002, userid: 0, groupid: 13, status: "draft", timemodified: agora() - 600, plugins: [] },
  ],
  902: [],
};

createServer(async (req, res) => {
  let corpo = "";
  for await (const parte of req) corpo += parte;
  const json = (status, j) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(j));
  };
  const url = new URL(req.url, BASE);
  // Endereços começando com /sso imitam um Moodle com login da instituição (Senha Única etc.).
  const sso = url.pathname.startsWith("/sso/");
  if (sso) url.pathname = url.pathname.slice(4);
  const p = new URLSearchParams(corpo);
  if (url.pathname === "/lib/ajax/service-nologin.php") {
    return json(200, [{ error: false, data: sso
      ? { sitename: "AVA Institucional", typeoflogin: 1, identityproviders: [{ name: "Login Institucional", url: `${BASE}/sso/auth` }], enablemobilewebservice: 1, maintenanceenabled: 0 }
      : { sitename: "AVA Teste", typeoflogin: 1, identityproviders: [], enablemobilewebservice: 1, maintenanceenabled: 0 } }]);
  }

  if (req.method === "POST" && url.pathname === "/__envio") {
    const e = JSON.parse(corpo);
    (ENVIOS[e.tarefa] ??= []).push({ ...e.envio, timemodified: agora() });
    return json(200, { ok: true });
  }
  if (url.pathname === "/login/token.php") {
    if (p.get("service") !== "moodle_mobile_app") return json(200, { error: "Serviço não disponível", errorcode: "servicenotavailable" });
    if (!sso && p.get("username") === "prof.moodle" && p.get("password") === "senha moodle") return json(200, { token: CHAVE, privatetoken: null });
    return json(200, { error: "Login inválido, por favor tente novamente", errorcode: "invalidlogin" });
  }
  if (url.pathname.startsWith("/webservice/pluginfile.php/")) {
    if (url.searchParams.get("token") !== CHAVE) return json(403, { error: "sem chave" });
    res.writeHead(200, { "content-type": "application/pdf" });
    return res.end("%PDF relatório do grupo azul");
  }
  if (url.pathname !== "/webservice/rest/server.php") return json(404, {});
  if (p.get("wstoken") !== CHAVE) return json(200, { exception: "moodle_exception", errorcode: "invalidtoken", message: "Token inválido" });

  switch (url.searchParams.get("wsfunction")) {
    case "core_webservice_get_site_info":
      return json(200, { sitename: "AVA Teste", fullname: "Marina Teixeira", userid: 2, functions: FUNCOES });
    case "core_enrol_get_users_courses":
      return json(200, [
        { id: 55, fullname: "Design de Interação", shortname: "DI-2026", visible: 1 },
        { id: 56, fullname: "Cálculo I", shortname: "CALC1", visible: 1 },
      ]);
    case "core_enrol_get_enrolled_users":
      return json(200, p.get("courseid") === "55" ? PESSOAS : []);
    case "mod_assign_get_assignments":
      return json(200, { courses: [{ id: 55, assignments: TAREFAS }], warnings: [] });
    case "mod_assign_get_submissions": {
      const id = Number(p.get("assignmentids[0]"));
      return json(200, { assignments: [{ assignmentid: id, submissions: ENVIOS[id] ?? [] }], warnings: [] });
    }
    case "mod_assign_get_grades":
      return json(200, { assignments: [{ assignmentid: Number(p.get("assignmentids[0]")), grades: [{ userid: 101, grade: "7.00000" }] }], warnings: [] });
    case "mod_assign_save_grade":
      if (registro) appendFileSync(registro, JSON.stringify(Object.fromEntries(p.entries())) + "\n");
      return json(200, null);
    default:
      return json(200, { exception: "webservice_access_exception", errorcode: "accessexception", message: "Função não disponível" });
  }
}).listen(porta, "127.0.0.1", () => console.log(`Moodle de mentira em ${BASE}`));

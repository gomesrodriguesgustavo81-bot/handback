// Teste de ponta a ponta da Fase 0, com Supabase local (npx supabase start)
// e o app rodando (npm run build && npm start).
//
// Uso: node scripts/teste-ponta-a-ponta.mjs [endereco-do-app] [pasta-das-fotos]
// Precisa do Playwright instalado e do Mailpit do Supabase local (porta 54324).
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");

const APP = process.argv[2] ?? "http://127.0.0.1:3000";
const FOTOS = process.argv[3] ?? "fotos-teste";
const MAILPIT = "http://127.0.0.1:54324";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sufixo = Date.now().toString(36);
const DONO = `dono-${sufixo}@handback.test`;
const ANA = `ana-${sufixo}@escola.test`;
const CURIOSO = `curioso-${sufixo}@qualquer.test`;
const SLUG = `escola-alfa-${sufixo}`;
const PROF = `prof-${sufixo}@escola.test`;

mkdirSync(FOTOS, { recursive: true });
let falhas = 0;
function confere(ok, oQue) {
  console.log(`${ok ? "ok" : "FALHOU"}: ${oQue}`);
  if (!ok) falhas++;
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function linkDoEmail(email) {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages = [] } = await r.json();
    if (messages.length) {
      const m = await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json();
      const link = (m.HTML ?? "").match(/href="([^"]*\/auth\/confirmar[^"]*)"/)?.[1] ?? (m.Text ?? "").match(/https?:\/\/\S+/)?.[0];
      if (link) return link.replace(/&amp;/g, "&").replace(/[)>\]]+$/, "");
    }
    await espera(500);
  }
  throw new Error(`Nenhum e-mail chegou para ${email}`);
}

// --- Acesso: senha + código do app autenticador (TOTP) ---
const SENHA = "Cafe com leite 2026";
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SEGREDO_SB = process.env.SUPABASE_SECRET_KEY;
const chavesTotp = new Map();

function totp(chave, quando = Date.now()) {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of chave.replace(/=+$/, "").toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(quando / 30000)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(contador).digest();
  const o = h[19] & 15;
  const n = (((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6;
  return String(n).padStart(6, "0");
}

/** Cria uma conta direto (como o dono faria no painel do Supabase), já com senha. */
async function criarConta(email) {
  const r = await fetch(`${SUPABASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SEGREDO_SB, authorization: `Bearer ${SEGREDO_SB}`, "content-type": "application/json" },
    body: JSON.stringify({ email, password: SENHA, email_confirm: true, app_metadata: { senha_definida: true } }),
  });
  if (!r.ok) throw new Error(`não criou ${email}: ${await r.text()}`);
}

/** Cadastra o app autenticador na tela "Proteja sua conta" (ou "Minha conta"). */
async function cadastrarCelular(p, email, botao = "Começar") {
  await p.getByRole("button", { name: botao }).click();
  const chave = (await p.getByLabel("Chave para digitar no app").innerText()).trim();
  chavesTotp.set(email, chave);
  await p.getByLabel("Código de 6 números").fill(totp(chave));
  await p.getByRole("button", { name: "Ativar" }).click();
}

/** Entra com e-mail e senha; se pedir, digita o código do celular. */
async function entrar(navegador, email, nome) {
  const ctx = await prepararContexto(navegador, { ...devices["Pixel 7"] });
  const p = await ctx.newPage();
  await p.goto(`${APP}/entrar`);
  await p.getByLabel("E-mail").fill(email);
  await p.getByLabel("Senha").fill(SENHA);
  await p.getByRole("button", { name: "Entrar", exact: true }).click();
  await p.waitForURL(/\/(app|entrar\/codigo|conta)/);
  if (nome) await p.screenshot({ path: `${FOTOS}/${nome}-entrou.png`, fullPage: true });
  if (p.url().includes("/entrar/codigo")) {
    await p.getByLabel("Código de 6 números").fill(totp(chavesTotp.get(email)));
    await p.getByRole("button", { name: "Confirmar" }).click();
    await p.waitForURL(/\/app/);
  }
  return { ctx, p };
}

/** Primeiro acesso por convite: link do e-mail → cria a senha → cadastra o celular. */
async function primeiroAcesso(navegador, email, nome) {
  const ctx = await prepararContexto(navegador, { ...devices["Pixel 7"] });
  const p = await ctx.newPage();
  await p.goto(await linkDoEmail(email));
  await p.waitForURL(/\/definir-senha/);
  if (nome) await p.screenshot({ path: `${FOTOS}/${nome}-criar-senha.png`, fullPage: true });
  await p.getByLabel("Nova senha").fill(SENHA);
  await p.getByLabel("Repita a senha").fill(SENHA);
  await p.getByRole("button", { name: "Salvar senha" }).click();
  // Conta nova: entra só com a senha e vê o lembrete (14 dias para ativar).
  await p.waitForURL(/\/app/);
  await p.getByRole("status", { name: "Proteja sua conta" }).waitFor();
  await p.goto(`${APP}/conta/duas-etapas`);
  await p.getByRole("link", { name: /^Fazer depois \(até/ }).waitFor();
  if (nome) await p.screenshot({ path: `${FOTOS}/${nome}-duas-etapas.png`, fullPage: true });
  await cadastrarCelular(p, email);
  await p.waitForURL(/\/app/);
  return { ctx, p };
}

/** Troca a turma na caixa do topo e espera a tela mostrar a escolhida. */
async function trocarTurma(p, nome) {
  await p.locator('select[name="turma"]').selectOption({ label: nome });
  await p.waitForFunction((n) => {
    const s = document.querySelector('select[name="turma"]');
    return s && !s.disabled && s.selectedOptions[0]?.textContent === n;
  }, nome);
}

/** Abre o menu da conta (círculo com as iniciais, no topo). */
async function menuConta(p) {
  await p.getByRole("button", { name: "Sua conta" }).click();
  return p.getByRole("menu", { name: "Sua conta" });
}

async function largura(p, oQue) {
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  confere(w <= 412, `${oQue} cabe no celular (${w}px)`);
}

/** Janelas de confirmação pedidas durante o teste (o título de cada uma). */
const confirmacoes = [];
/**
 * Prepara o navegador: toda janela de confirmação do Handback é anotada e
 * confirmada sozinha (a não ser que o teste ligue window.__semAuto para
 * clicar ele mesmo em "Sim" ou "Não").
 */
async function prepararContexto(navegador, opcoes) {
  const ctx = await navegador.newContext(opcoes);
  await ctx.exposeBinding("__anotarConfirmacao", (_origem, titulo) => {
    confirmacoes.push(titulo);
  });
  await ctx.addInitScript(() => {
    new MutationObserver(() => {
      const d = document.querySelector('[role="alertdialog"][aria-modal="true"]');
      if (!d || d.dataset.visto) return;
      d.dataset.visto = "1";
      window.__anotarConfirmacao?.([d.querySelector("h2")?.textContent, d.querySelector("p")?.textContent].filter(Boolean).join(" "));
      if (window.__semAuto) return;
      setTimeout(() => d.querySelectorAll("button")[1]?.click(), 60);
    }).observe(document, { childList: true, subtree: true });
  });
  return ctx;
}
const pediuConfirmacao = (trecho) => confirmacoes.some((t) => (typeof trecho === "string" ? t.includes(trecho) : trecho.test(t)));

const sql = (q) => execFileSync("psql", [DB, "-Atc", q]).toString().trim();
const navegador = await chromium.launch();
try {
  // 1) Área protegida sem login → vai para /entrar
  {
    const ctx = await prepararContexto(navegador, );
    const p = await ctx.newPage();
    await p.goto(`${APP}/app`);
    confere(new URL(p.url()).pathname === "/entrar", "sem login, /app manda para /entrar");
    await p.goto(`${APP}/admin`);
    confere(new URL(p.url()).pathname === "/entrar", "sem login, /admin manda para /entrar");
    await ctx.close();
  }

  // 2) Ninguém cria conta sozinho; senha errada não entra. O dono entra; ainda não é dono da plataforma
  {
    const ctx = await prepararContexto(navegador, { ...devices["Pixel 7"] });
    const p = await ctx.newPage();
    const resp = await p.goto(`${APP}/entrar`);
    confere(resp.headers()["x-frame-options"] === "DENY" && /max-age/.test(resp.headers()["strict-transport-security"] ?? ""), "cabeçalhos de segurança no site");
    await largura(p, "tela de entrar");
    await p.screenshot({ path: `${FOTOS}/0-entrar.png`, fullPage: true });
    const cadastro = await fetch(`${SUPABASE}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "", "content-type": "application/json" },
      body: JSON.stringify({ email: `invasor-${sufixo}@x.test`, password: "Senha forte 123456" }),
    });
    confere(!cadastro.ok, "ninguém cria conta sozinho (só por convite)");
    await ctx.close();
  }
  await criarConta(DONO);
  {
    const ctx = await prepararContexto(navegador, { ...devices["Pixel 7"] });
    const p = await ctx.newPage();
    await p.goto(`${APP}/entrar`);
    await p.getByLabel("E-mail").fill(DONO);
    await p.getByLabel("Senha").fill("Senha errada 2026");
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await p.getByText("E-mail ou senha incorretos.").waitFor();
    confere(true, "senha errada não entra (mensagem não revela se o e-mail existe)");
    await ctx.close();
  }
  const dono = await entrar(navegador, DONO, "1-dono");
  confere(await dono.p.getByText("Você ainda não faz parte de nenhum espaço").isVisible(), "dono novo vê lista vazia");
  const r = await dono.p.goto(`${APP}/admin`);
  confere(r.status() === 404, "antes de virar dono, /admin não existe para ele");

  // 3) Vira dono da plataforma (como no passo a passo do docs/)
  execFileSync("psql", [DB, "-qc",
    `insert into public.administradores_plataforma (user_id) select id from auth.users where email = '${DONO}'`]);
  await dono.p.goto(`${APP}/app`);
  await dono.p.waitForURL(/\/conta\/duas-etapas/);
  confere(true, "dono da plataforma é obrigado a ativar as duas etapas");
  await largura(dono.p, "ativar duas etapas");
  await cadastrarCelular(dono.p, DONO);
  await dono.p.waitForURL(/\/app/);
  confere(await (await menuConta(dono.p)).getByRole("menuitem", { name: "Administração do Handback" }).isVisible(), "aparece a Administração do Handback (no menu da conta)");

  // 4) Cria a empresa e convida a Ana
  await dono.p.goto(`${APP}/admin`);
  await dono.p.getByLabel("Nome do espaço").fill("Escola Alfa");
  await dono.p.getByLabel("Endereço no Handback").fill(SLUG);
  await dono.p.getByLabel("Tipo de uso").selectOption("educacao");
  await dono.p.getByLabel("E-mail de quem vai administrar").fill(ANA.toUpperCase());
  await dono.p.getByRole("button", { name: "Criar espaço" }).click();
  await dono.p.getByText(/Espaço "Escola Alfa" criado/).waitFor();
  confere(true, "empresa criada pelo painel");
  await largura(dono.p, "painel do dono");
  await dono.p.screenshot({ path: `${FOTOS}/2-painel-do-dono.png`, fullPage: true });

  // 5) Endereço repetido é recusado com mensagem clara
  await dono.p.getByLabel("Nome do espaço").fill("Outra");
  await dono.p.getByLabel("Endereço no Handback").fill(SLUG);
  await dono.p.getByLabel("Tipo de uso").selectOption("empresa");
  await dono.p.getByRole("button", { name: "Criar espaço" }).click();
  await dono.p.getByText("Já existe um espaço com o endereço").waitFor();
  confere(true, "endereço repetido é recusado");

  // 6) Ana entra e já é administradora da escola
  const ana = await primeiroAcesso(navegador, ANA, "3-ana");
  confere(true, "Ana recebe o convite, cria a senha e ativa as duas etapas");
  {
    // Senha fraca e senha diferente são recusadas (outro link de "esqueci a senha" não é preciso: testa na própria tela).
    const ctx = await prepararContexto(navegador, { ...devices["Pixel 7"] });
    const p = await ctx.newPage();
    await p.goto(`${APP}/entrar`);
    await p.getByLabel("E-mail").fill(ANA);
    await p.getByLabel("Senha").fill(SENHA);
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await p.waitForURL(/\/entrar\/codigo/);
    confere(true, "com a senha certa, ainda pede o código do celular");
    await p.goto(`${APP}/app/${SLUG}`);
    confere(new URL(p.url()).pathname === "/entrar/codigo", "sem o código, não abre a empresa");
    await p.getByLabel("Código de 6 números").fill("000000");
    await p.getByRole("button", { name: "Confirmar" }).click();
    await p.getByText("Código incorreto ou vencido").waitFor();
    confere(true, "código errado é recusado");
    await ctx.close();
  }
  confere(await ana.p.getByText("Escola Alfa").isVisible(), "Ana vê a Escola Alfa");
  confere(await (await menuConta(ana.p)).getByText("Seu papel: Administrador").isVisible(), "Ana é administradora (no menu da conta)");
  await ana.p.getByRole("button", { name: "Fechar o menu" }).click({ position: { x: 8, y: 400 } });
  await largura(ana.p, "minhas empresas");
  await ana.p.screenshot({ path: `${FOTOS}/4-minhas-empresas.png`, fullPage: true });
  await ana.p.getByText("Escola Alfa").click();
  // Primeiro acesso guiado (conta nova)
  await ana.p.waitForURL(new RegExp(`/app/${SLUG}/comecar$`));
  confere(true, "administrador de conta nova cai no primeiro acesso guiado");
  await ana.p.getByRole("radio", { name: /Escola ou curso/ }).click();
  await largura(ana.p, "primeiro acesso");
  await ana.p.screenshot({ path: `${FOTOS}/4b-primeiro-acesso.png`, fullPage: true });
  await ana.p.getByRole("button", { name: "Continuar" }).click();
  await ana.p.getByRole("radio", { name: /Grupos, com pessoas dentro/ }).click();
  await ana.p.getByRole("button", { name: "Continuar" }).click();
  await ana.p.getByRole("group", { name: "Os grupos que entregam" }).getByRole("button", { name: "Equipe", exact: true }).click();
  await ana.p.getByRole("group", { name: "As pessoas dentro de cada grupo" }).getByRole("button", { name: "Outro…" }).click();
  await ana.p.getByLabel("As pessoas dentro de cada grupo: outro nome").fill("Estudante");
  confere(await ana.p.getByText("Turma 2026 › Aula 2 › Equipe Azul (5 estudantes)").isVisible(), "prévia com o plural automático do nome digitado");
  await ana.p.screenshot({ path: `${FOTOS}/4c-nomes.png`, fullPage: true });
  await ana.p.getByRole("button", { name: "Continuar" }).click();
  await ana.p.getByRole("heading", { name: "Crie sua primeira turma" }).waitFor();
  confere(true, "artigo certo (feminino) para Turma");
  await ana.p.getByLabel("Nome").fill("Turma A");
  await ana.p.getByRole("button", { name: "Concluir" }).click();
  await ana.p.getByText("Tudo pronto!").waitFor();
  confere(await ana.p.getByRole("link", { name: /Cadastrar equipes/ }).isVisible(), "próximos passos com os nomes escolhidos");
  await ana.p.goto(`${APP}/app`);
  await ana.p.waitForURL(new RegExp(`/app/${SLUG}/entregas$`));
  confere(true, "quem tem uma empresa só entra direto nas Entregas");
  const abasAna = (await ana.p.getByRole("navigation", { name: "Seções da empresa" }).getByRole("link").allInnerTexts()).filter(Boolean);
  confere(abasAna.join("|") === "Entregas|Aulas|Equipes", `só 3 abas, com o vocabulário de escola (${abasAna.join(", ")})`);
  await ana.p.getByRole("button", { name: "Mais" }).click();
  const gavetaMais = ana.p.getByRole("dialog", { name: "Mais opções" });
  confere(await gavetaMais.getByRole("link", { name: "Configurações" }).isVisible() && await gavetaMais.getByRole("link", { name: "Relatórios" }).isVisible(), "celular: barra embaixo; Relatórios e Configurações ficam em “Mais”");
  await ana.p.screenshot({ path: `${FOTOS}/30b-mais.png` });
  await gavetaMais.getByRole("link", { name: "Configurações" }).click();
  await ana.p.getByRole("heading", { name: "Configurações" }).waitFor();
  confere(await ana.p.getByRole("link", { name: /Quem usa o Handback/ }).isVisible() && await ana.p.getByRole("link", { name: /Registro de atividades/ }).isVisible(), "Configurações reúnem o que é da conta inteira");
  await largura(ana.p, "configurações");
  await ana.p.screenshot({ path: `${FOTOS}/31-configuracoes.png`, fullPage: true });
  await ana.p.getByRole("link", { name: /Quem usa o Handback/ }).click();
  await ana.p.getByRole("link", { name: "← Configurações" }).waitFor();
  confere(true, "páginas de configuração têm o caminho de volta");
  await menuConta(ana.p);
  confere(!(await ana.p.getByRole("menuitem", { name: /^Trocar de/ }).count()), "“Trocar de …” não aparece para quem tem um espaço só");
  await ana.p.screenshot({ path: `${FOTOS}/32-menu-conta.png` });
  await ana.p.getByRole("button", { name: "Fechar o menu" }).click({ position: { x: 8, y: 400 } });
  await largura(ana.p, "painel da empresa");
  await ana.p.screenshot({ path: `${FOTOS}/5-painel-da-empresa.png`, fullPage: true });
  confere((await ana.p.goto(`${APP}/admin`)).status() === 404, "Ana não abre o Painel do dono");

  // 7) Um curioso não vê a escola nem pelo endereço direto
  await criarConta(CURIOSO);
  const curioso = await entrar(navegador, CURIOSO);
  confere(await curioso.p.getByText("Você ainda não faz parte de nenhum espaço").isVisible(), "curioso não vê empresas");
  {
    // "Esqueci minha senha": link por e-mail → senha nova (senha fraca é recusada).
    const ESQUECIDO = `esquecido-${sufixo}@qualquer.test`;
    await criarConta(ESQUECIDO);
    const ctx = await prepararContexto(navegador, { ...devices["Pixel 7"] });
    const p = await ctx.newPage();
    await p.goto(`${APP}/entrar/esqueci`);
    await p.getByLabel("Seu e-mail").fill(ESQUECIDO);
    await p.getByRole("button", { name: "Mandar link para nova senha" }).click();
    await p.getByText(/vai receber em instantes um e-mail/).waitFor();
    await p.goto(await linkDoEmail(ESQUECIDO));
    await p.waitForURL(/\/definir-senha/);
    await p.getByLabel("Nova senha").fill("curta123");
    await p.getByLabel("Repita a senha").fill("curta123");
    await p.getByRole("button", { name: "Salvar senha" }).click();
    await p.getByText(/pelo menos 12 caracteres/).waitFor();
    confere(true, "senha fraca é recusada");
    await p.getByLabel("Nova senha").fill("Outra senha boa 2027");
    await p.getByLabel("Repita a senha").fill("Outra senha boa 2027");
    await p.getByRole("button", { name: "Salvar senha" }).click();
    await p.waitForURL(/\/app/);
    confere(true, "esqueci minha senha: cria senha nova pelo link do e-mail");
    await ctx.close();
  }
  {
    // Convite no formato PADRÃO do Supabase (sem os modelos do Handback): a sessão vem depois do "#".
    const NOVO = `padrao-${sufixo}@qualquer.test`;
    const r = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: { apikey: SEGREDO_SB, authorization: `Bearer ${SEGREDO_SB}`, "content-type": "application/json" },
      body: JSON.stringify({ type: "invite", email: NOVO, redirect_to: `${APP}/auth/confirmar?voltar=/app` }),
    });
    const j = await r.json();
    const link = j.action_link ?? j.properties?.action_link;
    const ctx = await prepararContexto(navegador, { ...devices["Pixel 7"] });
    const p = await ctx.newPage();
    await p.goto(link);
    await p.waitForURL(/\/definir-senha/);
    confere(!p.url().includes("access_token"), "link padrão do Supabase leva a criar a senha (sem deixar o acesso na barra de endereço)");
    await p.goto(`${APP}/auth/continuar?voltar=/app#error=access_denied&error_code=otp_expired`);
    await p.getByText("O link expirou ou já foi usado").waitFor();
    confere(true, "link padrão vencido mostra mensagem clara");
    await ctx.close();
  }
  confere((await curioso.p.goto(`${APP}/app/${SLUG}`)).status() === 404, "curioso não abre a escola pelo endereço");

  // ===================== FASE 1: cadastros =====================
  ana.p.on("dialog", (d) => d.accept());

  // F1) Ana cadastra uma aula com checklist
  await ana.p.goto(`${APP}/app/${SLUG}/etapas`);
  await ana.p.getByRole("link", { name: "Adicionar aula" }).click();
  await ana.p.waitForURL(/\/etapas\/nova$/);
  confere((await ana.p.getByLabel("Nº").inputValue()) === "1", "número da primeira aula sugerido (1)");
  await ana.p.getByLabel("Título").fill("Diagnóstico");
  await ana.p.getByLabel("Recebe entregas de").fill("2099-12-01");
  await ana.p.getByLabel("Recebe entregas até").fill("2099-12-07");
  await ana.p.getByLabel("O que deve ser entregue (checklist)").fill("- Mapa de stakeholders\n\n2. Problema em uma frase");
  await ana.p.getByLabel("Critérios de qualidade").fill("Clareza e evidências");
  await largura(ana.p, "formulário de aula");
  await ana.p.screenshot({ path: `${FOTOS}/6-nova-aula.png`, fullPage: true });
  await ana.p.getByRole("button", { name: "Salvar" }).click();
  await ana.p.getByText("Cadastro salvo.").waitFor();
  confere(
    (await ana.p.getByLabel("O que deve ser entregue (checklist)").inputValue()) === "Mapa de stakeholders\nProblema em uma frase",
    "checklist salvo limpo (sem marcadores e sem linhas vazias)");

  // F2) Número repetido é recusado e o que foi digitado continua no formulário
  await ana.p.goto(`${APP}/app/${SLUG}/etapas/nova`);
  await ana.p.getByLabel("Nº").fill("1");
  await ana.p.getByLabel("Título").fill("Outra aula");
  await ana.p.getByRole("button", { name: "Salvar" }).click();
  await ana.p.getByText("Já existe aula com o número 1").waitFor();
  confere((await ana.p.getByLabel("Título").inputValue()) === "Outra aula", "erro não apaga o que foi digitado");

  // F3) Equipes com pessoas; e-mail repetido em outra equipe é recusado
  const pessoasNovas = async (lista) => {
    for (const [i, email] of lista.entries()) {
      if (!(await ana.p.getByLabel(`E-mail da pessoa ${i + 1}`).count())) await ana.p.getByRole("button", { name: "+ Outra pessoa" }).click();
      await ana.p.getByLabel(`E-mail da pessoa ${i + 1}`).fill(email);
    }
  };
  await ana.p.goto(`${APP}/app/${SLUG}/grupos`);
  const gavetaEquipe = ana.p.getByRole("dialog", { name: "Criar equipe" });
  await ana.p.getByRole("button", { name: "+ Criar equipe" }).click();
  await gavetaEquipe.getByLabel("Nome da equipe").fill("Equipe Azul");
  await pessoasNovas(["a1@aluno.test", "A2@Aluno.test", "a1@aluno.test"]);
  await gavetaEquipe.getByRole("button", { name: "Criar equipe", exact: true }).click();
  await ana.p.getByText("“Equipe Azul” cadastrado com 2 pessoas.").waitFor();
  confere(!(await gavetaEquipe.count()), "a janela de criar equipe fecha depois de salvar");
  {
    const azul = ana.p.getByRole("listitem").filter({ hasText: "Equipe Azul" });
    await azul.getByText("2 pessoas", { exact: true }).waitFor();
    confere(await azul.getByText("2 pessoas", { exact: true }).isVisible() && await azul.getByText("a1, a2").isVisible(), "lista mostra quantas pessoas e a prévia dos nomes");
    await azul.getByText(/Ver as 2 pessoas e os e-mails/).click();
    confere(await azul.getByText("a1@aluno.test").isVisible() && await azul.getByText("a2@aluno.test").isVisible(), "e-mails guardados em minúsculas e sem repetição");
  }
  await ana.p.getByRole("button", { name: "+ Criar equipe" }).click();
  await gavetaEquipe.getByLabel("Nome da equipe").fill("Equipe Verde");
  await pessoasNovas(["a1@aluno.test"]);
  await gavetaEquipe.getByRole("button", { name: "Criar equipe", exact: true }).click();
  await ana.p.getByText(/a1@aluno.test \(já está em “Equipe Azul”\)/).waitFor();
  confere(true, "o mesmo e-mail não entra em duas equipes");
  await pessoasNovas(["v1@aluno.test", "nao-e-email"]);
  await gavetaEquipe.getByRole("button", { name: "Criar equipe", exact: true }).click();
  await ana.p.getByText("Estes e-mails não parecem válidos: nao-e-email.").waitFor();
  confere(true, "e-mail inválido é apontado");
  await largura(ana.p, "criar equipe");
  await ana.p.screenshot({ path: `${FOTOS}/7a-criar-equipe.png` });
  await gavetaEquipe.getByRole("button", { name: "Fechar" }).click();
  await largura(ana.p, "equipes");
  await ana.p.screenshot({ path: `${FOTOS}/7-equipes.png`, fullPage: true });

  // F4) Ana convida um professor
  await ana.p.goto(`${APP}/app/${SLUG}/pessoas`);
  await ana.p.getByLabel("E-mail").fill(PROF);
  await ana.p.getByRole("button", { name: "Convidar" }).click();
  await ana.p.getByText(`Convite enviado para ${PROF}`).waitFor();
  confere(await ana.p.getByText("Convites aguardando (1)").isVisible(), "convite aparece na lista");
  await largura(ana.p, "pessoas");
  await ana.p.screenshot({ path: `${FOTOS}/8-pessoas.png`, fullPage: true });

  // F5) Professor entra: vê aulas e equipes, sem editar; não vê Pessoas nem Ajustes
  const prof = await primeiroAcesso(navegador, PROF);
  await prof.p.goto(`${APP}/app`);
  await prof.p.waitForURL(new RegExp(`/app/${SLUG}/entregas$`));
  const abas = (await prof.p.getByRole("navigation", { name: "Seções da empresa" }).getByRole("link").allInnerTexts()).filter(Boolean);
  confere(abas.join("|") === "Entregas|Aulas|Equipes" && !(await prof.p.getByRole("link", { name: "Configurações" }).count()), `professor vê as abas certas, sem a engrenagem (${abas.join(", ")})`);
  confere(await (await menuConta(prof.p)).getByText("Seu papel: Avaliador").isVisible(), "papel de avaliador (no menu da conta)");
  await prof.p.getByRole("button", { name: "Fechar o menu" }).click({ position: { x: 8, y: 400 } });
  await prof.p.getByRole("link", { name: "Aulas", exact: true }).click();
  await prof.p.waitForURL(/\/etapas$/);
  confere(!(await prof.p.getByRole("link", { name: "Adicionar aula" }).count()), "professor não vê o botão de adicionar aula");
  await prof.p.getByText("Aula 1 · Diagnóstico").click();
  await prof.p.waitForURL(/\/etapas\/[0-9a-f-]{36}$/);
  await prof.p.getByText("Mapa de stakeholders").waitFor();
  confere(!(await prof.p.getByRole("button", { name: "Salvar alterações" }).count()), "professor vê a aula só para leitura");
  confere((await prof.p.goto(`${APP}/app/${SLUG}/pessoas`)).status() === 404, "professor não abre Pessoas");
  confere((await prof.p.goto(`${APP}/app/${SLUG}/ajustes`)).status() === 404, "professor não abre Ajustes");
  await prof.p.goto(`${APP}/app/${SLUG}/grupos`);
  await prof.p.getByRole("listitem").filter({ hasText: "Equipe Azul" }).getByText(/Ver as \d+ pessoas e os e-mails/).click();
  confere(await prof.p.getByText("a2@aluno.test").isVisible(), "professor vê os e-mails das equipes");
  await prof.p.screenshot({ path: `${FOTOS}/9-professor.png`, fullPage: true });

  // F6) Ana troca o vocabulário: Aula → Encontro
  await ana.p.goto(`${APP}/app/${SLUG}/ajustes`);
  await ana.p.waitForURL(/\/configuracoes$/);
  confere(true, "o antigo Ajustes abre as Configurações");
  await ana.p.getByRole("link", { name: /Nomes usados aqui/ }).click();
  await ana.p.getByRole("heading", { name: "Nomes usados aqui" }).waitFor();
  confere((await ana.p.getByLabel("Cada pessoa").inputValue()) === "Estudante", "nome escolhido no primeiro acesso aparece em Nomes usados aqui");
  await ana.p.getByLabel("Como você chama este espaço?").fill("Escola");
  await ana.p.getByLabel("Como você chama este espaço?").press("Tab");
  await ana.p.getByText("Salvo ✓").first().waitFor();
  await ana.p.getByLabel("Cada etapa de entrega").fill("Encontro");
  confere(await ana.p.getByRole("region", { name: "Prévia" }).getByText("Encontros").isVisible(), "prévia das abas muda enquanto digita");
  await ana.p.getByLabel("Cada etapa de entrega").press("Tab");
  await ana.p.waitForFunction(() => document.querySelectorAll(".salvo-pilula").length >= 1 && [...document.querySelectorAll(".salvo-pilula")].every((x) => x.textContent === "Salvo ✓"));
  await ana.p.getByRole("navigation", { name: "Seções da empresa" }).getByRole("link", { name: "Encontros" }).waitFor();
  confere(true, "nomes salvam sozinhos (sem botão) e as abas mudam");
  await largura(ana.p, "nomes usados aqui");
  await ana.p.screenshot({ path: `${FOTOS}/33-nomes.png`, fullPage: true });
  await ana.p.goto(`${APP}/app/${SLUG}`);
  confere(await ana.p.getByRole("link", { name: "Encontros" }).first().isVisible(), "aba passa a se chamar Encontros");
  confere((await ana.p.locator("option", { hasText: "Encontro 1 · Diagnóstico" }).count()) > 0, "painel usa a palavra nova");
  await ana.p.screenshot({ path: `${FOTOS}/10-visao-geral.png`, fullPage: true });

  // F7) Ana tira um e-mail da equipe e apaga a aula
  await ana.p.goto(`${APP}/app/${SLUG}/grupos`);
  await ana.p.getByText("Equipe Azul").click();
  await ana.p.waitForURL(/\/grupos\/[0-9a-f-]{36}$/);
  confere(!(await ana.p.getByLabel("E-mails de quem entrega").count()), "editar: as pessoas ficam numa lista, não numa caixa de texto");
  {
    const pessoas = ana.p.getByRole("region", { name: "Pessoas" });
    await pessoas.getByText("+ Adicionar pessoa").click();
    await pessoas.getByLabel("Nome").fill("Ana Três");
    await pessoas.getByLabel("E-mail").fill("A3@Aluno.test");
    await pessoas.getByRole("button", { name: "Adicionar pessoa" }).click();
    await pessoas.getByText("Ana Três entrou.").waitFor();
    confere(await pessoas.getByText("a3@aluno.test").isVisible() && await pessoas.getByText("Pessoas (3)").isVisible(), "editar: adicionar pessoa com nome e e-mail");
    await largura(ana.p, "editar pessoas");
    await ana.p.screenshot({ path: `${FOTOS}/8b-editar-pessoas.png`, fullPage: true });
    for (const quem of ["a2@aluno.test", "Ana Três"]) {
      await pessoas.getByRole("button", { name: `Editar ${quem}` }).click();
      await pessoas.getByRole("button", { name: "Tirar desta lista" }).click();
      await ana.p.waitForFunction((q) => !document.querySelector('[aria-label="Pessoas"]').innerText.includes(q), quem === "Ana Três" ? "a3@aluno.test" : "a2@aluno.test");
    }
  }
  await ana.p.goto(`${APP}/app/${SLUG}/grupos`);
  confere(!(await ana.p.getByText("a2@aluno.test").count()), "e-mail removido da equipe");
  await ana.p.goto(`${APP}/app/${SLUG}/etapas`);
  await ana.p.getByText("Encontro 1 · Diagnóstico").click();
  await ana.p.waitForURL(/\/etapas\/[0-9a-f-]{36}$/);
  await ana.p.getByRole("button", { name: "Apagar encontro" }).click();
  await ana.p.waitForURL(new RegExp(`/app/${SLUG}/etapas$`));
  confere(await ana.p.getByText("Nada cadastrado ainda.", { exact: false }).isVisible(), "encontro apagado");

  // F8) Ana não consegue deixar a escola sem administrador
  await ana.p.goto(`${APP}/app/${SLUG}/pessoas`);
  const minhaLinha = ana.p.locator("li", { hasText: "(você)" });
  await minhaLinha.getByLabel("Papel").selectOption("avaliador");
  await minhaLinha.getByRole("button", { name: "Salvar papel" }).click();
  await minhaLinha.getByText("A empresa precisa de pelo menos um administrador.").waitFor();
  confere(true, "último administrador não pode ser rebaixado");

  // F9) Curioso continua sem ver nada dos cadastros
  confere((await curioso.p.goto(`${APP}/app/${SLUG}/grupos`)).status() === 404, "curioso não abre as equipes");

  // ===================== FASE 2: entregas por e-mail =====================
  // Simula o serviço de recebimento: e-mails que o Gmail do professor encaminhou.
  const SEGREDO = process.env.HANDBACK_EMAIL_SEGREDO;
  async function chegaEmail(campos, { chave = SEGREDO, para = ENDERECO } = {}) {
    const corpo = {
      FromFull: { Email: campos.de ?? "a1@aluno.test", Name: campos.nome ?? "Aluna Um" },
      ToFull: [{ Email: para }],
      Subject: campos.assunto,
      TextBody: campos.texto ?? "Segue nossa entrega.",
      HtmlBody: "",
      Date: (campos.data ?? new Date()).toUTCString(),
      Headers: [
        { Name: "Message-ID", Value: campos.id },
        ...(campos.respondeA ? [{ Name: "In-Reply-To", Value: campos.respondeA }] : []),
      ],
      Attachments: (campos.anexos ?? []).map((x) => ({ Name: x.nome, ContentType: x.tipo, Content: Buffer.from(x.conteudo).toString("base64") })),
    };
    const r = await fetch(`${APP}/api/emails/entrada${chave ? `?chave=${chave}` : ""}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });
    return { http: r.status, ...(await r.json()) };
  }

  // E1) Ana vê o endereço de recebimento e o passo a passo do Gmail
  await ana.p.goto(`${APP}/app/${SLUG}/configuracoes/recebimento`);
  const ENDERECO = (await ana.p.locator("code", { hasText: "@caixa.handback.test" }).innerText()).trim();
  confere(/^entregas\+[a-z0-9]{12}@caixa\.handback\.test$/.test(ENDERECO), `endereço de recebimento da empresa (${ENDERECO})`);
  confere(await ana.p.getByRole("button", { name: "Copiar endereço" }).isVisible(), "botão para copiar o endereço da turma");
  await ana.p.getByText("Ver a mensagem pronta").click();
  confere((await ana.p.locator("pre", { hasText: ENDERECO }).innerText()).includes("[ENTREGA] Encontro 1 - Equipe Azul"), "mensagem pronta para a turma, com o endereço e o assunto de exemplo");
  await ana.p.getByText("Opcional: receber no seu Gmail").click();
  await largura(ana.p, "ajustes com recebimento por e-mail");
  await ana.p.screenshot({ path: `${FOTOS}/11-recebimento.png`, fullPage: true });

  // E2) Ana cadastra o encontro 2 (prazo futuro) e mais uma equipe
  await ana.p.goto(`${APP}/app/${SLUG}/etapas/nova`);
  await ana.p.getByLabel("Nº").fill("2");
  await ana.p.getByLabel("Título").fill("Protótipo");
  await ana.p.getByLabel("Recebe entregas até").fill("2099-12-31");
  await ana.p.getByLabel("O que deve ser entregue (checklist)").fill("Protótipo navegável\nRoteiro de teste");
  await ana.p.getByRole("button", { name: "Salvar" }).click();
  await ana.p.getByText("Cadastro salvo.").waitFor();
  await ana.p.goto(`${APP}/app/${SLUG}/grupos`);
  await ana.p.getByRole("button", { name: "+ Criar equipe" }).click();
  await ana.p.getByRole("dialog", { name: "Criar equipe" }).getByLabel("Nome da equipe").fill("Equipe Roxa");
  await ana.p.getByRole("dialog", { name: "Criar equipe" }).getByRole("button", { name: "Criar equipe", exact: true }).click();
  await ana.p.getByText("“Equipe Roxa” cadastrado").waitFor();

  // E3) Chegam e-mails
  confere((await chegaEmail({ id: "<x@x>", assunto: "[ENTREGA] Encontro 2" }, { chave: "errada" })).http === 401, "sem a senha certa, o Handback recusa");
  const e1 = await chegaEmail({
    id: `<e1-${sufixo}@aluno>`,
    assunto: "[ENTREGA] Encontro 2 - Equipe Azul",
    anexos: [{ nome: "relatório final.pdf", tipo: "application/pdf", conteudo: "conteudo do relatorio" }],
  });
  confere(e1.status === "entrega", `e-mail no padrão vira entrega (${e1.motivo})`);
  const repetido = await chegaEmail({ id: `<e1-${sufixo}@aluno>`, assunto: "[ENTREGA] Encontro 2 - Equipe Azul" });
  confere(repetido.motivo === "e-mail já recebido antes", "o mesmo e-mail chegando de novo não duplica");
  const obrigado = await chegaEmail({
    id: `<e1b-${sufixo}@aluno>`, assunto: "RE: [ENTREGA] Encontro 2 - Equipe Azul", texto: "Obrigada, professora!", respondeA: `<e1-${sufixo}@aluno>`,
  });
  confere(obrigado.status === "ignorado", `"obrigada" na conversa é ignorado (${obrigado.motivo})`);
  const e2 = await chegaEmail({
    id: `<e2-${sufixo}@aluno>`, assunto: "[ENTREGA] Encontro 2 - Equipe Azul", texto: "Versão final: https://docs.google.com/presentation/d/abc/edit",
    data: new Date(Date.now() + 60000),
  });
  confere(e2.status === "entrega", "reenvio com link vira nova entrega");
  const novo = await chegaEmail({
    id: `<e3-${sufixo}@aluno>`, de: "novo@aluno.test", assunto: "[ENTREGA] Encontro 2 - Equipe Roxa",
    anexos: [{ nome: "roxa.pdf", tipo: "application/pdf", conteudo: "roxa" }],
  });
  confere(novo.status === "confirmar", `remetente não cadastrado vai para confirmar (${novo.motivo})`);
  const pessoal = await chegaEmail({
    id: `<e4-${sufixo}@aluno>`, assunto: "Documentos bolsista", anexos: [{ nome: "rg.pdf", tipo: "application/pdf", conteudo: "RG" }],
  });
  confere(pessoal.status === "ignorado", "documentos pessoais são ignorados");
  const naoGuardou = execFileSync("psql", [DB, "-Atc",
    `select count(*) from storage.objects where name like '%/emails/${pessoal.emailId}/%'`]).toString().trim();
  confere(naoGuardou === "0", "anexos de documentos pessoais NÃO são guardados");
  const gmail = await chegaEmail({
    id: `<g-${sufixo}@google>`, de: "forwarding-noreply@google.com", assunto: "(#12345) Confirmação de encaminhamento do Gmail",
    texto: "Código de confirmação: 987654",
  });
  confere(gmail.status === "confirmar", "confirmação do Gmail aparece para confirmar");
  const outraCaixa = await chegaEmail({ id: "<z@z>", assunto: "[ENTREGA] x" }, { para: "entregas+zzzzzzzzzzzz@caixa.handback.test" });
  confere(outraCaixa.ok === false, "caixa de entrada desconhecida é recusada");

  // E4) Quadro de entregas
  await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
  await ana.p.getByRole("link", { name: /Caixa de e-mails.*2 para confirmar/ }).waitFor();
  confere(true, "painel mostra 2 e-mails para confirmar");
  confere((await ana.p.locator("dl div", { hasText: "Recebidas" }).innerText()).includes("1/2"), "painel: 1/2 recebidas");
  confere(await ana.p.getByRole("link", { name: /Equipe Azul/ }).getByText("Sem análise").isVisible(), "cartão mostra a situação da equipe");
  await largura(ana.p, "quadro de entregas");
  await ana.p.screenshot({ path: `${FOTOS}/12-quadro-entregas.png`, fullPage: true });
  await ana.p.getByRole("link", { name: /Equipe Azul/ }).click();
  await ana.p.waitForURL(/\/entregas\/[0-9a-f-]{36}$/);
  confere(await ana.p.getByRole("link", { name: /docs\.google\.com\/presentation/ }).isVisible(), "entrega mostra o link do e-mail");
  await ana.p.getByText("Detalhes da análise").click();
  await ana.p.getByRole("link", { name: /\d\d\/\d\d\/\d{4} às/ }).first().click(); // a primeira versão
  await ana.p.getByText(/Substituída por um reenvio/).waitFor();
  const urlPrimeira = ana.p.url();
  const href = await ana.p.getByRole("link", { name: /relatório final\.pdf/ }).getAttribute("href");
  const baixado = await ana.p.request.get(new URL(href, APP).toString());
  confere(baixado.status() === 200 && (await baixado.text()) === "conteudo do relatorio", "anexo do e-mail é baixado da área privada");
  await ana.p.screenshot({ path: `${FOTOS}/13-detalhe-entrega.png`, fullPage: true });

  // E5) Caixa: professor também vê o endereço da turma
  await prof.p.goto(`${APP}/app/${SLUG}/entregas/caixa`);
  await prof.p.getByText("Endereço para receber as entregas").click();
  confere(await prof.p.getByText(ENDERECO, { exact: true }).isVisible(), "professor vê o endereço da turma na caixa de e-mails");

  // E5) Caixa: confirma o remetente novo e descarta a confirmação do Gmail (depois de ver o código)
  await ana.p.goto(`${APP}/app/${SLUG}/entregas/caixa`);
  const itemNovo = ana.p.locator("li.rounded-2xl", { hasText: "novo@aluno.test" });
  confere((await itemNovo.getByLabel("Equipe", { exact: true }).inputValue()).length > 0, "equipe sugerida pelo assunto já vem escolhida");
  await largura(ana.p, "caixa de e-mails");
  await ana.p.screenshot({ path: `${FOTOS}/14-caixa.png`, fullPage: true });
  await itemNovo.getByRole("button", { name: "É entrega" }).click();
  await itemNovo.waitFor({ state: "detached" });
  confere(true, "e-mail confirmado sai de “Para confirmar”");
  const itemGmail = ana.p.locator("li.rounded-2xl", { hasText: "forwarding-noreply@google.com" });
  confere(await itemGmail.getByText("987654").isVisible(), "código do Gmail aparece aberto no texto do e-mail");
  confere(!(await itemGmail.getByRole("button", { name: "É entrega" }).count()), "confirmação do Gmail não oferece virar entrega");
  await itemGmail.getByRole("button", { name: "Já confirmei no Gmail" }).click();
  await ana.p.getByText("Tudo em dia. Nada para confirmar.").waitFor();
  confere(true, "caixa fica vazia depois das decisões");
  await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
  confere((await ana.p.locator("dl div", { hasText: "Recebidas" }).innerText()).includes("2/2"), "painel: 2/2 depois de confirmar");

  // E6) Registro à mão, com arquivo
  await ana.p.getByText("Registrar entrega à mão").click();
  await ana.p.getByLabel("Equipe", { exact: true }).selectOption({ label: "Equipe Roxa" });
  await ana.p.getByLabel("Escolher arquivos").setInputFiles([{ name: "foto do quadro.jpg", mimeType: "image/jpeg", buffer: Buffer.from("jpg") }]);
  await ana.p.getByLabel("Comentário (opcional)").fill("Recebido em mãos");
  await ana.p.getByRole("button", { name: "Registrar entrega" }).click();
  await ana.p.getByText("Entrega registrada.").waitFor();
  await ana.p.reload();
  await ana.p.getByRole("link", { name: /Equipe Roxa/ }).getByText("Registrada à mão", { exact: true }).waitFor();
  confere(true, "registro à mão com arquivo aparece no quadro");

  // E7) Professor vê e baixa; curioso não vê nada
  await prof.p.goto(urlPrimeira);
  const hrefProf = await prof.p.getByRole("link", { name: /relatório final\.pdf/ }).getAttribute("href");
  confere((await prof.p.request.get(new URL(hrefProf, APP).toString())).status() === 200, "professor baixa o anexo");
  confere((await curioso.p.goto(`${APP}/app/${SLUG}/entregas`)).status() === 404, "curioso não abre o quadro");
  confere((await curioso.p.goto(`${APP}/app/${SLUG}/entregas/caixa`)).status() === 404, "curioso não abre a caixa de e-mails");
  confere((await curioso.p.goto(urlPrimeira)).status() === 404, "curioso não abre a entrega pelo endereço");

  // ===================== FASE 3: análise com IA e devolutivas =====================
  // (A IA é o "Gemini de mentira" de scripts/gemini-falso.mjs; o modelo configurado
  //  simula cota esgotada, então o Handback precisa trocar para o modelo reserva.)
  await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
  await ana.p.getByRole("button", { name: /Analisar com IA as 2 sem análise/ }).click();
  await ana.p.getByText("2 entregas entraram na fila. Pode fechar a página").waitFor();
  confere(true, "analisar todas põe na fila (pode fechar a página)");
  // Fecha a página de verdade: a análise continua no servidor.
  const urlPainel = ana.p.url();
  await ana.p.goto("about:blank");
  for (let i = 0; i < 40 && sql(`select count(*) from public.fila_analises f join public.organizacoes o on o.id = f.org_id where o.slug = '${SLUG}'`) !== "0"; i++) await espera(1500);
  confere(sql(`select count(*) from public.fila_analises f join public.organizacoes o on o.id = f.org_id where o.slug = '${SLUG}'`) === "0", "a fila termina sozinha com a página fechada");
  confere(sql(`select count(*) from public.avisos a join auth.users u on u.id = a.user_id where u.email = '${ANA}' and a.titulo = '2 análises prontas'`) === "1"
    && sql(`select count(*) from public.avisos a join auth.users u on u.id = a.user_id where u.email = '${ANA}' and a.titulo like 'Análise pronta:%'`) === "0", "no fim, um aviso só no sininho (não um por entrega)");
  await ana.p.goto(urlPainel);
  confere((await ana.p.locator("li a", { hasText: "Para revisar" }).filter({ hasText: "EXCELENTE" }).count()) === 2, "análise em lote das 2 entregas");
  confere((await ana.p.locator("dl div", { hasText: "Para revisar" }).innerText()).includes("2"), "painel conta 2 para revisar");
  await largura(ana.p, "painel da aula");
  await ana.p.screenshot({ path: `${FOTOS}/14b-painel.png`, fullPage: true });
  const pedidos = readFileSync(process.env.REGISTRO_IA, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  confere(pedidos.every((x) => x.temRegras && x.temEsquema), "pedido à IA leva as regras (sem notas) e o formato de resposta");
  confere(pedidos.some((x) => x.modelo === "modelo-sem-cota") && pedidos.some((x) => x.modelo === "gemini-flash-latest"), "sem cota no modelo principal, troca para o reserva");
  confere(pedidos.some((x) => x.anexos.includes("image/jpeg")), "a foto registrada à mão foi enviada para a IA ler");
  confere(pedidos.some((x) => x.texto.includes("1. Protótipo navegável\n2. Roteiro de teste")), "a IA recebe o checklist na ordem");
  confere(!pedidos.some((x) => /RG|bolsista/.test(x.texto)), "documento pessoal nunca chega à IA");

  await ana.p.getByRole("link", { name: /Equipe Azul/ }).click();
  await ana.p.waitForURL(/\/entregas\/[0-9a-f-]{36}$/);
  await ana.p.getByText("IA sugeriu").waitFor();
  confere(await ana.p.getByRole("radio", { name: "EXCELENTE" }).getAttribute("aria-checked") === "true", "conceito sugerido já vem marcado");
  const checklist = ana.p.getByRole("region", { name: "Checklist" });
  confere(await checklist.getByText("Protótipo navegável").isVisible(), "checklist item a item");
  confere(await checklist.getByRole("img", { name: "Entregue" }).first().isVisible(), "checklist com ícone de situação");
  confere(await ana.p.getByText("Não lido pela IA (só o endereço foi considerado)").isVisible(), "aviso de leitura do link aparece junto do link");
  confere(await ana.p.getByRole("link", { name: /relatório final\.pdf.*Lido pela IA/ }).isVisible() || await ana.p.getByText("Lido pela IA").first().isVisible(), "arquivo marcado como lido pela IA");
  // O mais importante aparece sem rolar (tela de celular).
  const dobra = await ana.p.evaluate(() => {
    const alto = window.innerHeight;
    const topo = (sel) => document.querySelector(sel)?.getBoundingClientRect().top ?? 9999;
    return { devolutiva: topo("textarea[name=devolutiva]"), checklist: topo("section[aria-label=Checklist]"), alto };
  });
  confere(dobra.devolutiva < dobra.alto && dobra.checklist < dobra.alto, `conceito, devolutiva e checklist aparecem sem rolar (${JSON.stringify(dobra)})`);
  confere(await ana.p.getByRole("button", { name: "Aprovar devolutiva" }).isVisible(), "botão Aprovar sempre visível no rodapé");
  await ana.p.getByText("Detalhes da análise").click();
  confere(await ana.p.getByText(/gemini-flash-latest/).isVisible(), "mostra o modelo usado");
  await largura(ana.p, "análise e devolutiva");
  await ana.p.screenshot({ path: `${FOTOS}/15-analise.png`, fullPage: true });

  // Revisão: muda o conceito, edita, salva rascunho, aprova, reabre, aprova de novo.
  await ana.p.getByRole("radio", { name: "BOM", exact: true }).click();
  await ana.p.getByLabel(/^Devolutiva para/).fill("Pessoal, ótima entrega! Ajustem o roteiro de teste e seguimos.");
  confere(await ana.p.getByText("Você mudou de EXCELENTE para BOM. Por quê?").isVisible(), "ao mudar o conceito da IA, pergunta o motivo");
  await ana.p.getByPlaceholder("Ex.: a pesquisa não tinha dados, só opinião").fill("O roteiro de teste estava incompleto");
  await ana.p.getByRole("button", { name: "Salvar rascunho" }).click();
  await ana.p.getByText("Rascunho salvo.").waitFor();
  await ana.p.reload();
  confere((await ana.p.getByLabel(/^Devolutiva para/).inputValue()).startsWith("Pessoal, ótima entrega!"), "rascunho editado fica salvo");
  confere(await ana.p.getByRole("radio", { name: "BOM", exact: true }).getAttribute("aria-checked") === "true", "conceito revisado fica salvo");
  await ana.p.getByRole("button", { name: "Aprovar devolutiva" }).click();
  await ana.p.getByText("Aprovada · BOM").waitFor();
  confere(await ana.p.getByRole("button", { name: "Copiar devolutiva" }).isVisible(), "devolutiva aprovada com botão de copiar");
  await ana.p.getByText("Detalhes da análise").click();
  confere(!(await ana.p.getByRole("button", { name: "Analisar de novo" }).count()), "aprovada não é reanalisada sem reabrir");
  confere(await ana.p.getByRole("link", { name: "Conectar meu Gmail" }).first().isVisible(), "aprovada sem Gmail conectado pede para conectar");
  await ana.p.getByRole("button", { name: "Reabrir para editar" }).click();
  await ana.p.getByRole("button", { name: "Aprovar devolutiva" }).waitFor();
  await ana.p.getByRole("button", { name: "Aprovar devolutiva" }).click();
  await ana.p.getByText("Aprovada · BOM").waitFor();
  confere(true, "reabrir e aprovar de novo");
  await ana.p.screenshot({ path: `${FOTOS}/16-devolutiva-aprovada.png`, fullPage: true });

  // ===================== FASE 4: envio pelo Gmail =====================
  // (O Google é o "Google de mentira" de scripts/google-falso.mjs.)
  const urlFolhaAzul = ana.p.url();
  await ana.p.getByRole("link", { name: "Conectar meu Gmail" }).first().click();
  await ana.p.getByText("Gmail conectado.").waitFor();
  confere(ana.p.url().startsWith(urlFolhaAzul), "depois de conectar o Gmail, volta para a mesma folha");
  confere(await ana.p.getByText(/Sai do seu Gmail \(professora@gmail\.test\)/).isVisible(), "mostra de qual Gmail vai sair");
  confere(await ana.p.getByText(/Vai para:.*a1@aluno\.test/).isVisible(), "mostra para quem vai antes de enviar");
  await ana.p.getByRole("button", { name: "Enviar para a equipe" }).click();
  await ana.p.getByText(/Enviada em .* para .*a1@aluno\.test/).waitFor();
  const enviados = readFileSync(process.env.REGISTRO_GMAIL, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const env = enviados.at(-1);
  confere(enviados.length === 1, "uma devolutiva enviada pelo Gmail");
  confere(/^To: a1@aluno\.test/m.test(env.cabecalho), "vai para quem mandou a entrega");
  confere(new RegExp(`^In-Reply-To: <e2-${sufixo}@aluno>`, "m").test(env.cabecalho), "responde na mesma conversa do e-mail da entrega");
  confere(env.texto.startsWith("Conceito: BOM\n\nPessoal, ótima entrega!"), "e-mail leva o conceito e a devolutiva aprovada");
  confere(env.html.includes("Devolutiva para Equipe Azul") && env.html.includes("Protótipo navegável"), "e-mail bonito (HTML) com a equipe e o checklist");
  writeFileSync(`${FOTOS}/email-devolutiva.html`, env.html);
  confere(await ana.p.getByRole("link", { name: /Seguinte →|Voltar ao painel/ }).isVisible(), "depois de enviar, ir para a próxima");
  await largura(ana.p, "devolutiva enviada");
  await ana.p.screenshot({ path: `${FOTOS}/17-devolutiva-enviada.png`, fullPage: true });

  await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
  confere((await ana.p.locator("dl div", { hasText: "Enviadas" }).innerText()).includes("1"), "painel conta as enviadas");
  confere((await ana.p.locator("dl div", { hasText: "Aprovadas" }).innerText()).includes("1"), "painel conta as devolutivas aprovadas");
  const cartaoAzul = ana.p.getByRole("link", { name: /Equipe Azul/ });
  confere((await cartaoAzul.getByText("Enviada", { exact: true }).isVisible()) && (await cartaoAzul.getByText("BOM", { exact: true }).isVisible()), "painel mostra o conceito e que foi enviada");
  confere(!(await ana.p.getByText("Devolutivas saem do seu Gmail").count()) && !(await ana.p.getByRole("button", { name: "Desconectar" }).count()), "conectado, o painel não mostra a faixa do Gmail (fica em Configurações › E-mail)");
  await ana.p.getByRole("link", { name: /^Aprovadas/ }).click();
  await ana.p.waitForURL(/filtro=aprovadas/);
  confere((await ana.p.evaluate(() => [...document.querySelectorAll("main a")].filter((a) => /\/entregas\/[0-9a-f-]{36}$/.test(a.getAttribute("href"))).length)) === 1, "filtro Aprovadas mostra só a aprovada");

  // Relatório da aula
  await ana.p.getByRole("link", { name: "Relatório da aula →" }).click();
  await ana.p.getByText("Relatório da aula", { exact: true }).waitFor();
  confere(await ana.p.getByText("Pessoal, ótima entrega! Ajustem o roteiro de teste e seguimos.").isVisible(), "relatório traz a devolutiva aprovada");
  confere(await ana.p.getByRole("button", { name: "Imprimir ou salvar PDF" }).isVisible(), "relatório pode ser impresso");
  await largura(ana.p, "relatório da aula");
  await ana.p.screenshot({ path: `${FOTOS}/18-relatorio.png`, fullPage: true });

  // Desconectar o Gmail
  await ana.p.goto(`${APP}/app/${SLUG}/configuracoes/email`);
  await ana.p.getByRole("button", { name: "Desconectar Gmail" }).click();
  await ana.p.getByText("Envie pelo seu Gmail").waitFor();
  await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
  await ana.p.getByRole("link", { name: "Conectar meu Gmail" }).waitFor();
  confere(true, "Gmail desconectado; painel volta a oferecer a conexão");

  // Professor vê a análise interna; falha da IA aparece com mensagem clara.
  await prof.p.goto(`${APP}/app/${SLUG}/entregas`);
  await prof.p.getByRole("link", { name: /Equipe Roxa/ }).click();
  await prof.p.getByText("Análise interna").click();
  confere(await prof.p.getByText(/Pontos fortes/).isVisible(), "professor lê a análise interna");
  await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
  await ana.p.getByText("Registrar entrega à mão").click();
  await ana.p.getByLabel("Equipe", { exact: true }).selectOption({ label: "Equipe Roxa" });
  await ana.p.getByLabel("Comentário (opcional)").fill("FORCAR_ERRO nesta versão");
  await ana.p.getByRole("button", { name: "Registrar entrega" }).click();
  await ana.p.getByText("Entrega registrada.").waitFor();
  await ana.p.reload();
  await ana.p.getByRole("link", { name: /Equipe Roxa/ }).click();
  await ana.p.waitForURL(/\/entregas\/[0-9a-f-]{36}$/);
  await ana.p.getByRole("button", { name: "Analisar com IA" }).click();
  await ana.p.getByText(/A IA não respondeu/).first().waitFor({ timeout: 90000 });
  {
    const ultimos = readFileSync(process.env.REGISTRO_IA, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    confere(ultimos.at(-1).correcoes.includes("Você sugeriu EXCELENTE, quem avalia deu BOM. Motivo: O roteiro de teste estava incompleto"),
      "a IA recebe os motivos das mudanças anteriores (calibração)");
  }
  confere(true, "falha da IA aparece com mensagem clara");
  await ana.p.reload();
  confere(await ana.p.getByRole("button", { name: "Tentar de novo" }).isVisible(), "dá para tentar de novo depois da falha");

  // 7b) Recebimento pelo Resend (webhook assinado + busca do e-mail na API do Resend de mentira)
  if (process.env.RESEND_WEBHOOK_SECRET) {
    const { createHmac } = await import("node:crypto");
    const idEmail = `em_${sufixo}`;
    await fetch(`${process.env.RESEND_API_BASE}/__emails`, {
      method: "POST",
      body: JSON.stringify({
        id: idEmail, from: "Pessoa Nova <nova@aluno.test>", to: [ENDERECO.replace("@caixa.handback.test", "@abc.resend.app")],
        subject: "[ENTREGA] Encontro 2 - Equipe Roxa", text: "Segue o trabalho em anexo.",
        headers: { "message-id": `<r-${sufixo}@aluno>` },
        anexos: [{ filename: "trabalho-resend.pdf", content_type: "application/pdf", conteudo: "pdf de teste" }],
      }),
    });
    const evento = JSON.stringify({ type: "email.received", created_at: new Date().toISOString(), data: { email_id: idEmail } });
    const ts = String(Math.floor(Date.now() / 1000));
    const chave = Buffer.from(process.env.RESEND_WEBHOOK_SECRET.replace(/^whsec_/, ""), "base64");
    const assinatura = `v1,${createHmac("sha256", chave).update(`msg_${sufixo}.${ts}.${evento}`).digest("base64")}`;
    const chamar = (sig) =>
      fetch(`${APP}/api/emails/resend`, {
        method: "POST",
        headers: { "content-type": "application/json", "svix-id": `msg_${sufixo}`, "svix-timestamp": ts, "svix-signature": sig },
        body: evento,
      });
    confere((await chamar("v1,assinaturafalsa")).status === 401, "Resend: chamada sem a assinatura certa é recusada");
    const r = await (await chamar(assinatura)).json();
    confere(r.ok === true && r.status === "confirmar", `Resend: e-mail recebido vai para a caixa (${r.status ?? r.motivo})`);
    await ana.p.goto(`${APP}/app/${SLUG}/entregas/caixa`);
    confere(await ana.p.locator("li.rounded-2xl", { hasText: "nova@aluno.test" }).getByText("trabalho-resend.pdf").isVisible(), "Resend: anexo baixado e guardado");

    // E-mail ignorado (veio de alguém da escola) com vídeo: o anexo não é guardado,
    // mas volta quando alguém diz que era entrega.
    const idIgn = `em_ign_${sufixo}`;
    await fetch(`${process.env.RESEND_API_BASE}/__emails`, {
      method: "POST",
      body: JSON.stringify({
        id: idIgn, from: `Ana <${ANA}>`, to: [ENDERECO.replace("@caixa.handback.test", "@abc.resend.app")],
        subject: "time roxa ciclo 2", text: "vídeo da equipe",
        headers: { "message-id": `<ign-${sufixo}@escola>` },
        anexos: [{ filename: "explica.mp4", content_type: "video/mp4", conteudo: "video de teste" }],
      }),
    });
    const ev2 = JSON.stringify({ type: "email.received", created_at: new Date().toISOString(), data: { email_id: idIgn } });
    const ass2 = `v1,${createHmac("sha256", chave).update(`msg2_${sufixo}.${ts}.${ev2}`).digest("base64")}`;
    const r2 = await (await fetch(`${APP}/api/emails/resend`, { method: "POST", headers: { "content-type": "application/json", "svix-id": `msg2_${sufixo}`, "svix-timestamp": ts, "svix-signature": ass2 }, body: ev2 })).json();
    confere(r2.status === "ignorado", `e-mail de alguém da escola é ignorado (${r2.status ?? r2.motivo})`);
    confere(sql(`select count(*) from storage.objects where name like '%explica.mp4'`) === "0", "privacidade: anexo de e-mail ignorado não é guardado");
    await ana.p.goto(`${APP}/app/${SLUG}/entregas/caixa?ver=ignorados`);
    const itemIgn = ana.p.locator("li.rounded-2xl", { hasText: "time roxa ciclo 2" });
    confere(await itemIgn.getByText(/Tinha 1 anexo \(explica\.mp4\)/).isVisible(), "a caixa mostra o anexo que não foi guardado");
    await itemIgn.getByLabel("Equipe", { exact: true }).selectOption({ label: "Equipe Roxa" });
    await itemIgn.locator('select[name="etapa"]').selectOption(sql(`select e.id from public.etapas e join public.turmas t on t.id = e.turma_id join public.organizacoes o on o.id = e.org_id where o.slug = '${SLUG}' and t.nome = 'Turma A' and e.numero = 2`));
    await itemIgn.getByRole("button", { name: "É entrega" }).click();
    await itemIgn.waitFor({ state: "detached" });
    const entIgn = sql(`select entrega_id from public.emails_recebidos where message_id = '<ign-${sufixo}@escola>'`);
    await ana.p.goto(`${APP}/app/${SLUG}/entregas/${entIgn}`);
    confere(await ana.p.getByText("explica.mp4").isVisible(), "ao virar entrega, o Handback busca o anexo de novo e ele aparece");
  }

  // 7b2) Como a IA está indo (calibração)
  await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
  await ana.p.getByRole("link", { name: "Como a IA está indo →" }).click();
  await ana.p.getByRole("heading", { name: "Como a IA está indo" }).waitFor();
  confere(await ana.p.getByText("O roteiro de teste estava incompleto").isVisible(), "painel da IA mostra o motivo da mudança");
  confere(await ana.p.getByText("Aprove pelo menos 3 devolutivas").isVisible(), "painel da IA pede mais avaliações antes de calcular");
  await largura(ana.p, "como a IA está indo");
  await ana.p.screenshot({ path: `${FOTOS}/21-calibracao.png`, fullPage: true });

  // 7b3) Evolução das equipes
  await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
  await ana.p.getByRole("link", { name: "Evolução →" }).click();
  await ana.p.getByRole("heading", { name: "Evolução", exact: true }).waitFor();
  const cartaoEvolucao = ana.p.locator("main li", { hasText: "Equipe Azul" }).first();
  confere((await cartaoEvolucao.innerText()).includes("BOM") && (await cartaoEvolucao.getByText(/aprovado BOM/).count()) > 0, "evolução mostra o conceito aprovado da equipe no ciclo");
  confere(await cartaoEvolucao.getByRole("link").first().getAttribute("href").then((h) => /\/entregas\/[0-9a-f-]{36}$/.test(h ?? "")), "tocar no conceito abre a folha da entrega");
  await largura(ana.p, "evolução das equipes");
  await ana.p.screenshot({ path: `${FOTOS}/22-evolucao.png`, fullPage: true });
  await ana.p.getByRole("link", { name: "Precisam de atenção" }).click();
  await ana.p.waitForURL(/ver=atencao/);
  confere(true, "filtro “Precisam de atenção”");

  // 7c) Registro de atividades
  {
    const ctx = await prepararContexto(navegador, { ...devices["Pixel 7"] });
    const p = await ctx.newPage();
    await p.goto(`${APP}/entrar`);
    await p.getByLabel("E-mail").fill(PROF);
    await p.getByLabel("Senha").fill("Senha errada 2026");
    await p.getByRole("button", { name: "Entrar", exact: true }).click();
    await p.getByText("E-mail ou senha incorretos.").waitFor();
    await ctx.close();
  }
  await ana.p.goto(`${APP}/app/${SLUG}/registro`);
  await ana.p.getByRole("heading", { name: "Registro de atividades" }).waitFor();
  const registro = await ana.p.locator("main ol").innerText();
  confere(registro.includes("Tentativa de entrar com senha errada"), "registro mostra a tentativa com senha errada do professor");
  await ana.p.goto(`${APP}/app/${SLUG}/registro?ver=avaliacoes`);
  confere((await ana.p.locator("main ol").innerText()).includes("Enviou a devolutiva de Equipe Azul"), "registro mostra o envio da devolutiva e para quem");
  await ana.p.goto(`${APP}/app/${SLUG}/registro?ver=documentos`);
  const docs = await ana.p.locator("main ol").innerText();
  confere(docs.includes("Abriu o arquivo “relatório final.pdf”") && docs.includes("Abriu a entrega de Equipe Azul"), "registro mostra quem abriu entregas e arquivos");
  confere(/Chrome no Android/.test(docs), "registro mostra o aparelho");
  await ana.p.goto(`${APP}/app/${SLUG}/registro?pessoa=${encodeURIComponent(PROF)}`);
  const doProf = await ana.p.locator("main ol").innerText();
  confere(doProf.includes(PROF) && !doProf.includes(ANA), "filtro por pessoa");
  const planilha = await ana.p.request.get(`${APP}/app/${SLUG}/registro/planilha?ver=documentos`);
  const csv = await planilha.text();
  confere(planilha.status() === 200 && csv.includes('"Data e hora";"Pessoa"') && csv.includes("relatório final.pdf"), "registro baixa em planilha");
  await largura(ana.p, "registro de atividades");
  await ana.p.screenshot({ path: `${FOTOS}/20-registro.png`, fullPage: true });
  confere((await prof.p.goto(`${APP}/app/${SLUG}/registro`)).status() === 404, "avaliador não abre o registro da empresa");
  await prof.p.goto(`${APP}/conta`);
  confere(await prof.p.getByText("Entrou com e-mail e senha").first().isVisible() || await prof.p.getByText("Ativou a verificação em duas etapas").first().isVisible(), "cada pessoa vê os próprios acessos em Minha conta");

  // 7d) Turmas dentro da conta + modo individual
  await ana.p.goto(`${APP}/app/${SLUG}/configuracoes/turmas`);
  await ana.p.locator("summary", { hasText: "+ Criar turma" }).click();
  const formTurma = ana.p.locator("details", { hasText: "+ Criar turma" });
  await formTurma.getByLabel("Nome").fill("Cálculo II");
  await formTurma.getByLabel("Quem entrega").selectOption("individual");
  await formTurma.getByRole("button", { name: "Criar" }).click();
  await ana.p.getByText("“Cálculo II” criada").waitFor();
  confere(true, "administrador cria outra turma");
  await trocarTurma(ana.p, "Cálculo II");
  await ana.p.goto(`${APP}/app/${SLUG}/configuracoes/recebimento`);
  const ENDERECO2 = (await ana.p.locator("code", { hasText: "@caixa.handback.test" }).innerText()).trim();
  confere(ENDERECO2 !== ENDERECO && /^entregas\+[a-z0-9]{12}@/.test(ENDERECO2), "cada turma tem o próprio endereço de e-mail");
  const abasT2 = await ana.p.getByRole("navigation", { name: "Seções da empresa" }).getByRole("link").allInnerTexts();
  confere(abasT2.includes("Estudantes"), `na turma individual a aba vira o nome das pessoas (${abasT2.join(", ")})`);
  await ana.p.goto(`${APP}/app/${SLUG}/grupos`);
  confere(await ana.p.getByText("Nada cadastrado ainda").isVisible(), "turma nova começa vazia (as equipes da outra turma não aparecem)");
  confere(!(await ana.p.getByRole("button", { name: /Criar equipe/ }).count()), "turma individual não tem “Criar equipe”");
  await ana.p.getByRole("button", { name: "Colar uma lista" }).click();
  await ana.p.getByLabel("Lista de estudantes").fill("Bia Souza; a1@aluno.test\nCarlos Lima <carlos@aluno.test>\nSem Email");
  await ana.p.getByText("2 pronto(s) para cadastrar · 1 com problema").waitFor();
  await ana.p.screenshot({ path: `${FOTOS}/23-colar-lista.png`, fullPage: true });
  await ana.p.getByRole("button", { name: "Cadastrar 2 estudantes" }).click();
  await ana.p.getByText("2 cadastrado(s).").waitFor();
  confere((await ana.p.getByLabel("Lista de estudantes").inputValue()) === "Sem Email", "linha com problema fica na caixa para corrigir");
  await ana.p.getByRole("dialog").getByRole("button", { name: "Fechar" }).click();
  confere(await ana.p.getByText("Carlos Lima").first().isVisible(), "estudantes cadastrados em lote (o mesmo e-mail pode estar em outra turma)");
  await largura(ana.p, "cadastrar em lote");
  await ana.p.goto(`${APP}/app/${SLUG}/etapas/nova`);
  confere((await ana.p.getByLabel("Nº").inputValue()) === "1", "numeração das etapas é por turma");
  await ana.p.getByLabel("Título").fill("Derivadas");
  await ana.p.getByLabel("Recebe entregas de").fill("2099-12-01");
  await ana.p.getByLabel("Recebe entregas até").fill("2099-12-07");
  await ana.p.getByLabel("O que deve ser entregue (checklist)").fill("Lista de exercícios");
  await ana.p.getByRole("button", { name: "Salvar" }).click();
  await ana.p.getByText("Cadastro salvo.").waitFor();
  const naTurma2 = await chegaEmail({ id: `<t2-${sufixo}@aluno>`, assunto: "[ENTREGA] Encontro 1", de: "a1@aluno.test" }, { para: ENDERECO2 });
  confere(naTurma2.ok === true && naTurma2.status === "entrega", `e-mail no endereço da turma 2 vira entrega da Bia nessa turma (${naTurma2.status ?? naTurma2.motivo})`);
  await ana.p.goto(`${APP}/app/${SLUG}/entregas?busca=bia`);
  const listaInd = ana.p.getByRole("list", { name: "Estudantes" });
  confere(await listaInd.getByText("Bia Souza").isVisible() && !(await listaInd.getByText("Carlos Lima").count()), "painel individual em lista compacta, com busca pelo nome");
  await largura(ana.p, "painel individual");
  await ana.p.screenshot({ path: `${FOTOS}/24-painel-individual.png`, fullPage: true });
  await trocarTurma(ana.p, "Turma A");
  confere(await ana.p.getByRole("link", { name: /Equipe Azul/ }).first().isVisible(), "voltando para a Turma A, as equipes dela voltam");

  // 7e) Ligação com o Moodle (Moodle de mentira em 4558)
  if (process.env.REGISTRO_MOODLE) {
    const MOODLE = "http://127.0.0.1:4558";
    await ana.p.goto(`${APP}/app/${SLUG}/configuracoes`);
    await ana.p.getByRole("link", { name: /^Moodle/ }).click();
    await ana.p.getByRole("heading", { name: "Ligar ao Moodle" }).waitFor();
    // Moodle com login da instituição: o Handback percebe sozinho e mostra o caminho da chave.
    await ana.p.getByLabel("Endereço do Moodle").fill("rodrigues@usp.br");
    await ana.p.getByRole("button", { name: "Continuar" }).click();
    await ana.p.getByText(/Isso é um e-mail/).waitFor();
    confere(true, "Moodle: e-mail no lugar do endereço mostra aviso claro");
    await ana.p.getByLabel("Endereço do Moodle").fill(`${MOODLE}/sso/login/index.php`);
    await ana.p.getByRole("button", { name: "Continuar" }).click();
    await ana.p.getByText("Como você entra nesse Moodle?").waitFor();
    await ana.p.getByRole("radio", { name: "Com Login Institucional" }).check();
    const guia = ana.p.getByRole("list", { name: "Como pegar a chave de acesso" });
    confere(await guia.getByText(/Chaves de segurança/).isVisible() && await guia.getByText("127.0.0.1:4558/sso").isVisible(),
      "Moodle: login da instituição mostra o guia ilustrado da chave, com o endereço certo");
    confere(await ana.p.getByLabel("Chave de acesso", { exact: true }).isVisible() && !(await ana.p.getByLabel("Senha do Moodle").count()), "Moodle: no caminho da chave não pede senha");
    await largura(ana.p, "guia da chave do Moodle");
    await ana.p.screenshot({ path: `${FOTOS}/26-moodle-chave.png`, fullPage: true });
    await ana.p.getByRole("button", { name: "Trocar" }).click();

    await ana.p.getByLabel("Endereço do Moodle").fill(`${MOODLE}/login/index.php`);
    await ana.p.getByRole("button", { name: "Continuar" }).click();
    await ana.p.getByText("AVA Teste").waitFor();
    confere(!(await ana.p.getByText("Como você entra nesse Moodle?").count()), "Moodle: com senha própria vai direto para usuário e senha");
    await ana.p.getByLabel("Usuário do Moodle").fill("prof.moodle");
    await ana.p.getByLabel("Senha do Moodle").fill("senha errada");
    await ana.p.getByRole("button", { name: "Conectar ao Moodle" }).click();
    await ana.p.getByText(/não aceitou esse usuário e senha/).waitFor();
    confere(true, "Moodle: senha errada mostra mensagem clara");
    await largura(ana.p, "ligar ao Moodle");
    await ana.p.screenshot({ path: `${FOTOS}/26-moodle-entrar.png`, fullPage: true });
    await ana.p.getByLabel("Senha do Moodle").fill("senha moodle");
    await ana.p.getByRole("button", { name: "Conectar ao Moodle" }).click();
    await ana.p.getByText("Conectado como Marina Teixeira").waitFor();
    confere(true, "Moodle: conecta com usuário e senha");
    const guardado = sql(`select token_cifrado from public.contas_moodle c join public.organizacoes o on o.id = c.org_id where o.slug = '${SLUG}'`);
    confere(guardado.startsWith("v1.") && !guardado.includes("senha") && !guardado.includes("chavemoodle"), "Moodle: só a chave fica guardada, cifrada (a senha não)");
    await ana.p.getByRole("radio", { name: /Design de Interação/ }).check();
    await largura(ana.p, "escolher disciplina do Moodle");
    await ana.p.screenshot({ path: `${FOTOS}/27-moodle-disciplina.png`, fullPage: true });
    await ana.p.getByRole("button", { name: "Criar turma com esta disciplina" }).click();
    await ana.p.getByText("“Design de Interação” criada").waitFor();
    const resumo = await ana.p.getByText(/Vieram do Moodle/).innerText();
    confere(/4 alunos em 3 \S+, 2 tarefas e 1 entregas/.test(resumo), `Moodle: alunos, grupos, tarefas e entregas vieram juntos (${resumo.slice(0, 70)})`);
    await ana.p.screenshot({ path: `${FOTOS}/28-moodle-pronta.png`, fullPage: true });
    confere(sql(`select string_agg(g.nome || ':' || coalesce((select string_agg(i.email, ',' order by i.email) from public.integrantes i where i.grupo_id = g.id), ''), ' | ' order by g.nome)
      from public.grupos g join public.turmas t on t.id = g.turma_id where t.nome = 'Design de Interação' and t.org_id = (select id from public.organizacoes where slug = '${SLUG}')`)
      === "Diego Rocha: | Grupo Azul:ana.souza@aluno.test,bruno.lima@aluno.test | Grupo Verde:carla.dias@aluno.test", "Moodle: grupos com os e-mails; aluno sem grupo vira o próprio grupo; professora fica de fora");

    confere(sql(`select string_agg(i.nome || '=' || i.matricula, ' | ' order by i.email) from public.integrantes i join public.turmas t on t.id = i.turma_id
      where t.nome = 'Design de Interação' and t.org_id = (select id from public.organizacoes where slug = '${SLUG}')`)
      === "Ana Souza=2026-0312 | Bruno Lima=11223344 | Carla Dias=", "Moodle: nome e matrícula vêm sozinhos (número de identificação ou usuário só com números); sem número fica vazio");
    {
      const urlTurma = ana.p.url();
      const azul = sql(`select g.id from public.grupos g join public.turmas t on t.id = g.turma_id where g.nome = 'Grupo Azul' and t.nome = 'Design de Interação' and t.org_id = (select id from public.organizacoes where slug = '${SLUG}')`);
      await ana.p.goto(`${APP}/app/${SLUG}/grupos/${azul}`);
      const lista = ana.p.getByRole("region", { name: "Pessoas" });
      await lista.getByText("Os nomes vieram do Moodle").waitFor();
      confere(await lista.getByText("Ana Souza").isVisible() && await lista.getByText("2026-0312").isVisible(), "Moodle: o cadastro mostra nome e matrícula de cada aluno");
      await lista.getByRole("button", { name: "Editar Bruno Lima" }).click();
      await lista.getByLabel("Matrícula (opcional)").fill("99887766");
      await lista.getByLabel("Matrícula (opcional)").press("Enter");
      await lista.getByText("Salvo ✓").waitFor();
      confere(sql(`select matricula from public.integrantes where email = 'bruno.lima@aluno.test' and grupo_id = '${azul}'`) === "99887766", "corrigir a matrícula salva sozinho");
      await largura(ana.p, "integrantes com matrícula");
      await ana.p.screenshot({ path: `${FOTOS}/28b-integrantes.png`, fullPage: true });
      // Renomear e apagar direto na lista
      await ana.p.goto(`${APP}/app/${SLUG}/grupos`);
      const verde = ana.p.getByRole("listitem").filter({ hasText: "Grupo Verde" });
      await verde.getByRole("button", { name: "Renomear" }).click();
      await ana.p.getByLabel("Novo nome").fill("Grupo Verde Claro");
      await ana.p.getByLabel("Novo nome").press("Enter");
      await ana.p.getByRole("link", { name: /Grupo Verde Claro/ }).getByText("Salvo ✓").waitFor();
      await ana.p.reload();
      confere(await ana.p.getByRole("link", { name: /Grupo Verde Claro/ }).isVisible(), "renomear a equipe direto na lista");
      const diego = ana.p.getByRole("listitem").filter({ hasText: "Diego Rocha" });
      await diego.getByRole("button", { name: /^Apagar/ }).click();
      await ana.p.waitForFunction(() => !document.body.innerText.includes("Diego Rocha"));
      confere(pediuConfirmacao(/Apagar “Diego Rocha”\? .*o Moodle não traz de volta/), "apagar a equipe pede confirmação e avisa do Moodle");
      await largura(ana.p, "lista de equipes");
      await ana.p.screenshot({ path: `${FOTOS}/28c-equipes.png`, fullPage: true });
      await ana.p.goto(urlTurma);
    }
    await ana.p.getByRole("link", { name: "Ver as entregas" }).click();
    const faixa = ana.p.getByRole("region", { name: "Moodle" });
    await faixa.getByText("Ligada ao Moodle · Design de Interação").waitFor();
    await faixa.getByText("Tarefas do Moodle que o Handback corrige").click();
    const forum = faixa.getByRole("listitem").filter({ hasText: "Fórum de apresentação" });
    await forum.getByRole("checkbox").uncheck();
    await forum.getByText("Fora").waitFor();
    await ana.p.reload();
    await ana.p.getByRole("region", { name: "Moodle" }).getByText("Tarefas do Moodle que o Handback corrige").click();
    confere(!(await ana.p.getByRole("region", { name: "Moodle" }).getByRole("listitem").filter({ hasText: "Fórum de apresentação" }).getByRole("checkbox").isChecked()), "Moodle: tarefa desmarcada fica fora");
    await largura(ana.p, "painel ligado ao Moodle");
    await ana.p.screenshot({ path: `${FOTOS}/29-moodle-painel.png`, fullPage: true });

    const etapaMoodle = sql(`select e.id from public.etapas e join public.organizacoes o on o.id = e.org_id where o.slug = '${SLUG}' and e.moodle_tarefa = 901`);
    await ana.p.goto(`${APP}/app/${SLUG}/etapas/${etapaMoodle}`);
    confere((await ana.p.getByLabel("Título").inputValue()) === "Protótipo navegável", "Moodle: tarefa virou etapa com o mesmo nome");
    await ana.p.getByLabel("O que deve ser entregue (checklist)").fill("Link do protótipo\nRelatório do teste");
    await ana.p.getByRole("button", { name: "Salvar" }).click();
    await ana.p.getByText("Alterações salvas.").waitFor();

    await ana.p.goto(`${APP}/app/${SLUG}/entregas?etapa=${etapaMoodle}`);
    await ana.p.getByRole("link", { name: /Grupo Azul/ }).click();
    await ana.p.waitForURL(/\/entregas\/[0-9a-f-]{36}$/);
    confere(await ana.p.getByText(/recebida .* pelo Moodle/).isVisible(), "Moodle: folha mostra que veio do Moodle");
    confere(await ana.p.getByText("relatório do grupo.pdf").first().isVisible(), "Moodle: arquivo da entrega foi trazido");
    await ana.p.getByRole("button", { name: "Analisar com IA" }).click();
    await ana.p.getByRole("button", { name: "Aprovar devolutiva" }).waitFor({ timeout: 60000 });
    await ana.p.getByRole("button", { name: "Aprovar devolutiva" }).click();
    await ana.p.getByText("Como devolver").waitFor();
    const rotuloNota = await ana.p.getByText(/Lançar a nota no Moodle:/).innerText();
    const notaEsperada = rotuloNota.match(/: ([\d,]+) \(de 10\)/)?.[1];
    confere(Boolean(notaEsperada), `Moodle: mostra a nota do conceito antes de lançar (${rotuloNota})`);
    await largura(ana.p, "devolver no Moodle");
    await ana.p.screenshot({ path: `${FOTOS}/30-moodle-devolver.png`, fullPage: true });
    await ana.p.getByRole("button", { name: "Devolver", exact: true }).click();
    await ana.p.getByText(/Devolvida no Moodle em/).waitFor();
    const gravou = readFileSync(process.env.REGISTRO_MOODLE, "utf8").trim().split("\n").map((l) => JSON.parse(l)).at(-1);
    confere(gravou.assignmentid === "901" && gravou.applytoall === "1" && ["101", "102"].includes(gravou.userid), "Moodle: devolutiva vai para a tarefa, valendo para o grupo todo");
    confere(gravou.grade === notaEsperada.replace(",", "."), `Moodle: nota lançada (${gravou.grade})`);
    confere(/^<p><strong>Conceito: \w+<\/strong><\/p><p>/.test(gravou["plugindata[assignfeedbackcomments_editor][text]"] ?? ""), "Moodle: comentário com o conceito e o texto");

    await ana.p.goto(`${APP}/app/${SLUG}/entregas?etapa=${etapaMoodle}`);
    await ana.p.getByRole("button", { name: "Buscar entregas agora" }).click();
    await ana.p.getByText(/Nada novo no Moodle|Acabou de buscar/).waitFor();
    await fetch(`${MOODLE}/__envio`, {
      method: "POST",
      body: JSON.stringify({ tarefa: 901, envio: { id: 7003, userid: 0, groupid: 13, status: "submitted", plugins: [{ type: "onlinetext", editorfields: [{ name: "onlinetext", text: "<p>Nosso protótipo: https://figma.com/proto/verde</p>" }] }] } }),
    });
    await espera(21000);
    await ana.p.getByRole("button", { name: "Buscar entregas agora" }).click();
    await ana.p.getByText("1 entrega nova chegou do Moodle.").waitFor();
    await ana.p.getByRole("link", { name: /Grupo Verde/ }).waitFor();
    confere(true, "Moodle: “Buscar entregas agora” traz o envio novo");
    await ana.p.goto(`${APP}/app/${SLUG}/grupos`);
    confere(!(await ana.p.getByRole("link", { name: /Diego Rocha/ }).count()) && sql(`select g.escondido || '/' || g.ativo from public.grupos g join public.turmas t on t.id = g.turma_id
      where g.nome = 'Diego Rocha' and t.org_id = (select id from public.organizacoes where slug = '${SLUG}')`) === "true/false", "Moodle: equipe apagada não volta depois de buscar de novo");
    confere(!(await ana.p.getByText("T-DI-2026").count()), "Moodle: grupo com a turma toda não vira equipe");
    await ana.p.getByText(/^Apagadas \(/).click();
    await ana.p.getByRole("listitem").filter({ hasText: "Diego Rocha" }).getByRole("button", { name: "Trazer de volta" }).click();
    await ana.p.getByRole("link", { name: /Diego Rocha/ }).waitFor();
    confere(true, "equipe apagada pode ser trazida de volta");
    await ana.p.goto(`${APP}/app/${SLUG}/registro?ver=avaliacoes`);
    confere((await ana.p.locator("main ol").innerText()).includes("Devolveu no Moodle a devolutiva de"), "Moodle: devolução aparece no registro de atividades");
    // Desligar e ligar de novo: a turma volta a ficar ligada sozinha.
    await ana.p.goto(`${APP}/app/${SLUG}/moodle`);
    await ana.p.getByRole("button", { name: "Desligar" }).click();
    await ana.p.getByRole("button", { name: "Continuar" }).waitFor();
    const turmaMoodle = `select coalesce(moodle_conta::text, 'sem') from public.turmas where nome = 'Design de Interação' and org_id = (select id from public.organizacoes where slug = '${SLUG}')`;
    confere(sql(turmaMoodle) === "sem", "Moodle: desligar tira a ligação da turma");
    await ana.p.getByLabel("Endereço do Moodle").fill(MOODLE);
    await ana.p.getByRole("button", { name: "Continuar" }).click();
    await ana.p.getByLabel("Usuário do Moodle").fill("prof.moodle");
    await ana.p.getByLabel("Senha do Moodle").fill("senha moodle");
    await ana.p.getByRole("button", { name: "Conectar ao Moodle" }).click();
    await ana.p.getByText("Conectado como Marina Teixeira").waitFor();
    confere(sql(turmaMoodle) !== "sem", "Moodle: ligar de novo religa a turma que já existia");
    await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
    await trocarTurma(ana.p, "Turma A");
  }

  // 7h) Aparência, aba E-mail e calendário
  {
    await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
    let menu = await menuConta(ana.p);
    await menu.getByRole("button", { name: "Escuro" }).click();
    confere((await ana.p.evaluate(() => document.documentElement.dataset.tema)) === "escuro", "tema escuro muda a tela na hora");
    await ana.p.reload();
    confere((await ana.p.evaluate(() => document.documentElement.dataset.tema)) === "escuro", "tema escuro continua depois de recarregar");
    confere((await ana.p.evaluate(() => getComputedStyle(document.body).backgroundColor)) === "rgb(11, 23, 21)", "no tema escuro o fundo fica escuro");
    await ana.p.screenshot({ path: `${FOTOS}/40-tema-escuro.png`, fullPage: true });
    menu = await menuConta(ana.p);
    confere((await menu.getByRole("button", { name: "Escuro" }).getAttribute("aria-pressed")) === "true", "menu mostra o tema escolhido");
    await menu.getByRole("button", { name: "Claro" }).click();
    confere((await ana.p.evaluate(() => getComputedStyle(document.body).backgroundColor)) === "rgb(244, 247, 245)", "tema claro volta o fundo claro");
    await menu.getByRole("button", { name: "Sistema" }).click();
    confere((await ana.p.evaluate(() => document.documentElement.dataset.tema)) === undefined, "tema Sistema segue o aparelho");

    // E-mail: conectar abre só uma janelinha do Google, que fecha sozinha
    await menu.getByRole("menuitem", { name: "E-mail de envio (Gmail)" }).click();
    await ana.p.getByRole("heading", { name: "E-mail", exact: true }).waitFor();
    const [janela] = await Promise.all([ana.p.waitForEvent("popup"), ana.p.getByRole("link", { name: "Conectar com Google" }).click()]);
    await ana.p.getByText("Gmail conectado", { exact: true }).waitFor();
    await janela.waitForEvent("close", { timeout: 10000 }).catch(() => {});
    confere(janela.isClosed(), "a janelinha do Google fecha sozinha");
    confere(ana.p.url().endsWith("/configuracoes/email") && (await ana.p.getByText("professora@gmail.test").isVisible()), "conecta o Gmail sem sair da tela");
    await largura(ana.p, "aba E-mail");
    await ana.p.screenshot({ path: `${FOTOS}/41-email.png`, fullPage: true });
    await ana.p.evaluate(() => (window.__semAuto = true));
    await ana.p.getByRole("button", { name: "Desconectar Gmail" }).click();
    const janelaConf = ana.p.getByRole("alertdialog");
    confere(await janelaConf.getByRole("heading", { name: "Desconectar?" }).isVisible() && await janelaConf.getByText(/As devolutivas param/).isVisible(), "desconectar pede confirmação numa janela");
    const caixaJanela = await ana.p.locator(".fixed.inset-0.z-\\[60\\]").boundingBox();
    const tela = ana.p.viewportSize();
    confere(caixaJanela && caixaJanela.width >= tela.width - 1 && caixaJanela.height >= tela.height - 1, "a janela cobre a tela toda");
    await largura(ana.p, "janela de confirmação");
    await espera(400);
    await ana.p.screenshot({ path: `${FOTOS}/49-confirmar.png` });
    await janelaConf.getByRole("button", { name: "Não" }).click();
    confere(!(await ana.p.getByRole("alertdialog").count()) && await ana.p.getByText("Gmail conectado", { exact: true }).isVisible(), "dizer Não fecha a janela e mantém o Gmail");
    await ana.p.getByRole("button", { name: "Desconectar Gmail" }).click();
    await ana.p.keyboard.press("Escape");
    confere(!(await ana.p.getByRole("alertdialog").count()) && await ana.p.getByText("Gmail conectado", { exact: true }).isVisible(), "Esc também cancela");
    await ana.p.getByRole("button", { name: "Desconectar Gmail" }).click();
    await ana.p.getByRole("alertdialog").getByRole("button", { name: "Sim, confirmar" }).click();
    await ana.p.evaluate(() => (window.__semAuto = false));
    await ana.p.getByText("Envie pelo seu Gmail").waitFor();
    confere(sql(`select count(*) from public.contas_gmail g join auth.users u on u.id = g.user_id where u.email = '${ANA}'`) === "0", "desconectar apaga a ligação do Gmail");

    // Calendário na aba das aulas
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const umaEtapa = sql(`select e.id || '|' || coalesce(e.recebe_ate::text, '') from public.etapas e join public.turmas t on t.id = e.turma_id
      where t.nome = 'Turma A' and t.org_id = (select id from public.organizacoes where slug = '${SLUG}') order by e.numero limit 1`);
    const [idEtapa, prazoAntigo] = umaEtapa.split("|");
    sql(`update public.etapas set recebe_ate = '${hoje}' where id = '${idEtapa}'`);
    await ana.p.goto(`${APP}/app/${SLUG}/etapas`);
    await ana.p.getByRole("link", { name: "Calendário" }).click();
    await ana.p.waitForURL(/ver=calendario/);
    const diaHoje = ana.p.getByRole("button", { name: /, hoje/ });
    confere((await diaHoje.getAttribute("aria-pressed")) === "true" && /vence/.test(await diaHoje.getAttribute("aria-label")), "calendário abre no dia de hoje, com o prazo marcado");
    const doDia = ana.p.getByRole("region", { name: "Dia escolhido" });
    confere(await doDia.getByText(/Prazo de entrega · \d+ de \d+ já entregaram/).isVisible() && await doDia.getByText("Vence", { exact: true }).isVisible(), "tocar no dia mostra o que vence e quantos já entregaram");
    confere(await ana.p.getByText("Abre", { exact: true }).isVisible() && await ana.p.getByText("Hoje", { exact: true }).first().isVisible(), "legenda com Abre, Vence e Hoje em maiúscula");
    await largura(ana.p, "calendário");
    await ana.p.screenshot({ path: `${FOTOS}/42-calendario.png`, fullPage: true });
    await ana.p.getByRole("button", { name: "Próximo mês" }).click();
    await doDia.getByText(/Prazo de entrega/).waitFor();
    confere(true, "trocar de mês mantém o dia escolhido");
    await ana.p.getByRole("link", { name: "Lista" }).click();
    await ana.p.waitForURL((u) => !u.search.includes("calendario"));
    confere(!(await ana.p.getByRole("grid").count()), "volta para a lista");
    sql(`update public.etapas set recebe_ate = ${prazoAntigo ? `'${prazoAntigo}'` : "null"} where id = '${idEtapa}'`);
  }

  // 7i) Avisos: sininho, meus avisos, lembretes aos alunos e a rodada das 9h
  {
    const somar = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const orgId = sql(`select id from public.organizacoes where slug = '${SLUG}'`);
    const anaId = sql(`select id from auth.users where email = '${ANA}'`);
    confere(Number(sql(`select count(*) from public.avisos where user_id = '${anaId}' and tipo in ('entrega', 'atraso')`)) > 0, "entregas por e-mail viram avisos para a administradora");
    await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
    const sino = ana.p.getByRole("button", { name: /^Avisos, \d+ novos?$/ });
    await sino.click();
    const painel = ana.p.getByRole("region", { name: "Avisos" });
    confere(await painel.getByText(/entregou/).first().isVisible(), "sininho mostra as entregas que chegaram");
    await largura(ana.p, "sininho aberto");
    await ana.p.screenshot({ path: `${FOTOS}/43-sininho.png`, fullPage: true });
    await painel.getByRole("button", { name: "Marcar todos como lidos" }).click();
    await ana.p.getByRole("button", { name: "Avisos", exact: true }).waitFor();
    confere(sql(`select count(*) from public.avisos where user_id = '${anaId}' and lido_em is null`) === "0", "marcar todos como lidos");
    await ana.p.keyboard.press("Escape");
    await ana.p.goto(`${APP}/conta/avisos`);
    const tipos = ana.p.getByRole("region", { name: "Do que quero saber" });
    await tipos.getByLabel(/Devolutiva enviada por um colega/).check();
    await tipos.getByText("Salvo ✓").waitFor();
    confere(sql(`select array_to_string(tipos, ',') from public.preferencias_avisos where user_id = '${anaId}'`).includes("enviada"), "meus avisos: escolher do que quero saber salva sozinho");
    confere(await ana.p.getByText(/Ativar neste aparelho|Este navegador não recebe|bloqueadas/).first().isVisible(), "meus avisos: mostra como ativar no celular");
    const chave = await ana.p.evaluate(async () => (await (await fetch("/api/push")).json()).chave);
    confere(/^[\w-]{80,}$/.test(chave ?? ""), "notificações: o Handback cria a própria chave sozinho");
    const salvou = await ana.p.evaluate(async () => (await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: "https://push.exemplo.test/aparelho-teste-1", keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } }) })).status);
    confere(salvou === 200 && sql(`select count(*) from public.aparelhos_push where user_id = '${anaId}'`) === "1", "notificações: o aparelho fica guardado");
    confere((await ana.p.evaluate(async () => (await fetch("/api/push", { method: "POST", body: "{\"endpoint\":\"http://inseguro\"}" })).status)) === 400, "notificações: endereço inseguro é recusado");
    await largura(ana.p, "meus avisos");
    await ana.p.screenshot({ path: `${FOTOS}/44-meus-avisos.png`, fullPage: true });

    // Lembretes para os alunos (Turma A)
    await ana.p.goto(`${APP}/app/${SLUG}/configuracoes/email`);
    const [janela] = await Promise.all([ana.p.waitForEvent("popup"), ana.p.getByRole("link", { name: "Conectar com Google" }).click()]);
    await ana.p.getByText("Gmail conectado", { exact: true }).waitFor();
    await janela.waitForEvent("close", { timeout: 10000 }).catch(() => {});
    await ana.p.goto(`${APP}/app/${SLUG}/configuracoes`);
    await ana.p.getByRole("link", { name: /^Lembretes para os alunos/ }).click();
    await ana.p.getByRole("heading", { name: "Lembretes para os alunos" }).waitFor();
    for (const nome of ["2 dias antes do prazo", "No dia do prazo"]) {
      await ana.p.getByLabel(nome).click();
      await ana.p.getByRole("region", { name: "Quando lembrar" }).getByText("Salvo ✓").first().waitFor();
    }
    await ana.p.reload();
    confere(await ana.p.getByText("professora@gmail.test").isVisible(), "lembretes saem do Gmail de quem ligou");
    const turmaA = sql(`select id from public.turmas where org_id = '${orgId}' and nome = 'Turma A'`);
    const [etapaL, prazoL] = sql(`select id || '|' || coalesce(recebe_ate::text, '') from public.etapas where turma_id = '${turmaA}' order by numero limit 1`).split("|");
    // Uma equipe que ainda não entregou e uma aula que vence no dia seguinte
    const grupoL = sql(`insert into public.grupos (org_id, turma_id, nome) values ('${orgId}', '${turmaA}', 'Equipe Lembrete') returning id`).split("\n")[0];
    sql(`insert into public.integrantes (org_id, turma_id, grupo_id, email, nome) values ('${orgId}', '${turmaA}', '${grupoL}', 'lembrete@aluno.test', 'Lia Lembrete')`);
    const dia = somar(hoje, 30);
    sql(`update public.etapas set recebe_ate = '${somar(dia, 2)}' where id = '${etapaL}'`);
    const etapaP = sql(`insert into public.etapas (org_id, turma_id, numero, titulo, recebe_ate) values ('${orgId}', '${turmaA}', 98, 'Aula do prazo', '${somar(dia, 1)}') returning id`).split("\n")[0];
    await ana.p.reload();
    confere(await ana.p.getByRole("region", { name: "Próximos lembretes" }).getByText(/2 dias antes/).first().isVisible(), "tela mostra os próximos lembretes");
    await largura(ana.p, "lembretes");
    await ana.p.screenshot({ path: `${FOTOS}/45-lembretes.png`, fullPage: true });
    const esperados = Number(sql(`select count(*) from public.grupos g where g.turma_id = '${turmaA}' and g.ativo and not g.escondido
      and exists (select 1 from public.integrantes i where i.grupo_id = g.id) and not exists (select 1 from public.entregas e where e.etapa_id = '${etapaL}' and e.grupo_id = g.id)`));
    // Alguém para avisar no resumo do dia
    sql(`insert into public.avisos (user_id, org_id, tipo, titulo, texto) values ('${anaId}', '${orgId}', 'entrega', 'Equipe Teste entregou', 'Aviso para o resumo')`);
    const rodar = (seg) => fetch(`${APP}/api/cron/diario?dia=${dia}`, { headers: seg ? { authorization: `Bearer ${seg}` } : {} });
    confere((await rodar("")).status === 401 && (await rodar("errado-errado-errado-errado")).status === 401, "rodada diária não roda sem o segredo");
    const antes = existsSync(process.env.REGISTRO_GMAIL) ? readFileSync(process.env.REGISTRO_GMAIL, "utf8").trim().split("\n").length : 0;
    const r1 = await (await rodar(process.env.CRON_SECRET)).json();
    confere(r1.ok && r1.lembretes === esperados && esperados > 0, `rodada das 9h manda lembrete a quem não entregou (${r1.lembretes} de ${esperados})`);
    const novos = readFileSync(process.env.REGISTRO_GMAIL, "utf8").trim().split("\n").slice(antes).map((l) => JSON.parse(l));
    const lembrete = novos.find((m) => /Subject: =\?UTF-8\?B\?/.test(m.cabecalho) && m.texto.includes("Ainda não recebemos"));
    confere(Boolean(lembrete) && /^From: professora@gmail\.test/m.test(lembrete.cabecalho) && lembrete.texto.includes("Como entregar"), "lembrete sai do Gmail da professora, com o que e como entregar");
    const resumo = novos.find((m) => new RegExp(`^To: ${ANA.replace(/[.+]/g, "\\$&")}`, "m").test(m.cabecalho));
    confere(Boolean(resumo) && resumo.texto.includes("Equipe Teste entregou") && r1.resumos >= 1, "resumo do dia chega por e-mail para quem tem aviso novo");
    confere(r1.prazos >= 1 && Number(sql(`select count(*) from public.avisos where user_id = '${anaId}' and tipo = 'prazo'`)) >= 1, "aviso de prazo amanhã para quem avalia");
    const r2 = await (await rodar(process.env.CRON_SECRET)).json();
    confere(r2.lembretes === 0 && r2.resumos === 0, "rodar de novo no mesmo dia não manda nada repetido");
    sql(`update public.etapas set recebe_ate = ${prazoL ? `'${prazoL}'` : "null"} where id = '${etapaL}'`);
    sql(`delete from public.etapas where id = '${etapaP}'`);
    sql(`delete from public.grupos where id = '${grupoL}'`);
    sql(`update public.turmas set lembrete_dois_dias = false, lembrete_no_dia = false where id = '${turmaA}'`);
  }

  // 7j) Relatórios: PDF da equipe, PDF da turma, planilha e notas para o Moodle
  {
    await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
    await ana.p.getByRole("link", { name: "Relatórios (PDF e planilha) →" }).click();
    await ana.p.getByRole("heading", { name: "Relatórios" }).waitFor();
    const media = ana.p.getByRole("region", { name: "Média final (opcional)" });
    confere(!(await media.getByRole("checkbox").isChecked()), "média final começa desligada (é opcional)");
    // Sem média: o PDF não fala em média
    const hrefSem = await ana.p.getByRole("link", { name: "Abrir o PDF" }).getAttribute("href");
    await ana.p.goto(`${APP}${hrefSem}`);
    await ana.p.getByRole("heading", { name: "Equipe Azul" }).waitFor();
    confere(!(await ana.p.getByText("Média final").count()), "sem média ligada, o relatório não mostra média");
    await ana.p.goBack();
    await media.getByLabel("Calcular média final nesta turma").check();
    await media.getByText("Salvo ✓").waitFor();
    await media.getByRole("spinbutton").first().waitFor();
    await media.getByRole("spinbutton").first().fill("2");
    await media.getByRole("spinbutton").first().blur();
    await media.getByText("Salvo ✓").first().waitFor();
    confere(sql(`select media_ativa from public.turmas where nome = 'Turma A' and org_id = (select id from public.organizacoes where slug = '${SLUG}')`) === "t", "ligar a média salva sozinho");
    await largura(ana.p, "relatórios");
    await ana.p.screenshot({ path: `${FOTOS}/46-relatorios.png`, fullPage: true });

    const href = await ana.p.getByRole("link", { name: "Abrir o PDF" }).getAttribute("href");
    confere(href.includes("dev=1") && href.includes("check=1"), "PDF da equipe com devolutivas e checklist por padrão");
    await ana.p.goto(`${APP}${href}`);
    await ana.p.getByRole("heading", { name: "Equipe Azul" }).waitFor();
    confere(await ana.p.getByText("Conceito mais recente").isVisible() && await ana.p.getByText("Média final").isVisible(), "PDF da equipe com o resumo e a média");
    confere(await ana.p.getByText(/Pessoal, ótima entrega!/).first().isVisible(), "PDF da equipe traz a devolutiva aprovada");
    confere(await ana.p.getByRole("img", { name: /Conceito encontro a encontro/i }).isVisible(), "PDF da equipe com o gráfico de evolução");
    confere(await ana.p.getByText(/Contém dados pessoais dos alunos/).isVisible(), "relatório avisa que tem dados pessoais");
    confere(!(await ana.p.getByText(/Pontos fortes|Análise interna/).count()), "análise interna da IA nunca vai para o relatório");
    await ana.p.emulateMedia({ media: "print" });
    confere(!(await ana.p.getByRole("button", { name: "Imprimir ou salvar PDF" }).isVisible()) && !(await ana.p.locator('select[name="turma"]').isVisible()), "na impressão só sai a folha");
    await ana.p.screenshot({ path: `${FOTOS}/47-pdf-equipe.png`, fullPage: true });
    await ana.p.emulateMedia({ media: "screen" });

    await ana.p.goto(`${APP}/app/${SLUG}/relatorios/turma?aulas=todas`);
    await ana.p.getByRole("heading", { name: "Turma A" }).waitFor();
    confere(await ana.p.getByRole("img", { name: /Conceitos em cada encontro/i }).isVisible() && await ana.p.getByText("Precisam de atenção").isVisible(), "PDF da turma com as barras e quem precisa de atenção");
    await largura(ana.p, "PDF da turma");
    await ana.p.screenshot({ path: `${FOTOS}/48-pdf-turma.png`, fullPage: true });

    const xlsx = await ana.p.request.get(`${APP}/app/${SLUG}/relatorios/planilha?formato=xlsx&aulas=todas`);
    const corpo = await xlsx.body();
    confere(xlsx.status() === 200 && /spreadsheetml/.test(xlsx.headers()["content-type"]) && corpo.subarray(0, 2).toString() === "PK", "planilha em Excel");
    const csv = await (await ana.p.request.get(`${APP}/app/${SLUG}/relatorios/planilha?formato=csv&mat=1`)).text();
    const [cabCsv, ...linhasCsv] = csv.replace(/^\uFEFF/, "").trim().split("\r\n");
    confere(cabCsv.startsWith("Equipe;") && cabCsv.includes("Matrícula") && cabCsv.includes("Média (0 a 10)") && linhasCsv.some((l) => l.startsWith("Equipe Azul;") && l.includes("BOM")), "planilha CSV: uma linha por aluno, com equipe, matrícula, conceitos e média");
    {
      const anonimo = await prepararContexto(navegador, );
      const r = await anonimo.request.get(`${APP}/app/${SLUG}/relatorios/planilha?formato=csv`, { maxRedirects: 0 });
      confere(r.status() >= 300 && r.status() < 400 && /\/entrar/.test(r.headers().location ?? ""), "planilha exige login");
      await anonimo.close();
    }

    if (process.env.REGISTRO_MOODLE) {
      await trocarTurma(ana.p, "Design de Interação (Moodle)");
      await ana.p.goto(`${APP}/app/${SLUG}/relatorios`);
      await ana.p.getByText("Notas para o Moodle").click();
      const hrefMoodle = await ana.p.getByRole("link", { name: "Baixar arquivo para o Moodle" }).getAttribute("href");
      const moodle = await (await ana.p.request.get(`${APP}${hrefMoodle}`)).text();
      const [cabM, ...linhasM] = moodle.trim().split("\r\n");
      confere(cabM === "Endereço de email,Protótipo navegável" && linhasM.some((l) => /^ana\.souza@aluno\.test,\d+(\.\d)?$/.test(l)), `arquivo de notas para importar no Moodle (${linhasM.find((l) => l.startsWith("ana")) ?? "?"})`);
      await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
      await trocarTurma(ana.p, "Turma A");
    }
  }

  // 7k) Google Agenda: cada um conecta a própria conta; a turma ganha uma agenda com os prazos
  {
    const GOOGLE = process.env.HANDBACK_GOOGLE_BASE.replace(/\/$/, "");
    const agendasFalsas = async () => (await fetch(`${GOOGLE}/__agenda`)).json();
    const daTurma = async () => Object.values(await agendasFalsas()).find((a) => a.summary === "Handback · Turma A");
    const anaId = sql(`select id from auth.users where email = '${ANA}'`);
    await ana.p.goto(`${APP}/app/${SLUG}/configuracoes`);
    await ana.p.getByRole("link", { name: /^Google Agenda/ }).click();
    await ana.p.getByRole("heading", { name: "Google Agenda", exact: true }).waitFor();
    confere(await ana.p.getByLabel(/Pôr os prazos na minha agenda/).isDisabled(), "agenda: só liga depois de conectar a própria conta");
    const [janelaG] = await Promise.all([ana.p.waitForEvent("popup"), ana.p.getByRole("link", { name: "Conectar Google Agenda" }).click()]);
    await ana.p.getByRole("region", { name: "Sua conta Google" }).getByText("professora@gmail.test").waitFor();
    await janelaG.waitForEvent("close", { timeout: 10000 }).catch(() => {});
    confere(sql(`select servico from public.conexoes_google where user_id = '${anaId}'`) === "agenda", "agenda: conexão própria, separada do Gmail");
    confere(sql(`select count(*) from public.conexoes_google where user_id = '${anaId}' and token_cifrado like 'v1.%'`) === "1", "agenda: a chave do Google fica cifrada");

    await ana.p.getByLabel(/Pôr os prazos na minha agenda/).click();
    await ana.p.getByText(/Agenda criada na sua conta Google/).waitFor();
    let ag = await daTurma();
    const evs = Object.values(ag?.eventos ?? {});
    const prazo = sql(`select e.recebe_ate from public.etapas e join public.turmas t on t.id = e.turma_id where t.nome = 'Turma A' and t.org_id = (select id from public.organizacoes where slug = '${SLUG}') and e.recebe_ate is not null order by e.numero limit 1`);
    const evPrazo = evs.find((e) => e.summary.startsWith("Prazo: "));
    confere(Boolean(ag) && evPrazo?.start.date === prazo && evPrazo.reminders.overrides?.[0]?.minutes === 1440, `agenda "Handback · Turma A" criada com o prazo e lembrete de 1 dia (${evs.length} eventos)`);
    confere(evs.every((e) => !e.attendees), "agenda: sem convidar, nenhum aluno é chamado");
    await largura(ana.p, "google agenda");
    await ana.p.screenshot({ path: `${FOTOS}/50-agenda.png`, fullPage: true });

    // Mudar a aula no Handback muda o evento sozinho
    const etapaId = sql(`select e.id from public.etapas e join public.turmas t on t.id = e.turma_id where t.nome = 'Turma A' and t.org_id = (select id from public.organizacoes where slug = '${SLUG}') and e.recebe_ate is not null order by e.numero limit 1`);
    const tituloAntigo = sql(`select titulo from public.etapas where id = '${etapaId}'`);
    await ana.p.goto(`${APP}/app/${SLUG}/etapas/${etapaId}`);
    await ana.p.getByLabel("Título").fill(`${tituloAntigo} v2`);
    await ana.p.getByRole("button", { name: "Salvar" }).click();
    await ana.p.getByText("Alterações salvas.").waitFor();
    let mudou = false;
    for (let i = 0; i < 20 && !mudou; i++) {
      mudou = Object.values((await daTurma())?.eventos ?? {}).some((e) => e.summary.endsWith(`${tituloAntigo} v2`));
      if (!mudou) await espera(500);
    }
    confere(mudou, "agenda: mudar a aula no Handback muda o evento sozinho");
    await ana.p.getByLabel("Título").fill(tituloAntigo);
    await ana.p.getByRole("button", { name: "Salvar" }).click();
    await ana.p.getByText("Alterações salvas.").waitFor();

    await ana.p.goto(`${APP}/app/${SLUG}/configuracoes/agenda`);
    await ana.p.getByLabel(/Convidar os alunos/).click();
    await ana.p.getByRole("region", { name: "Alunos" }).getByText("Salvo ✓").waitFor();
    ag = await daTurma();
    confere(ag.envios.some((x) => x.para.includes("a1@aluno.test")), "agenda: com convite, o Google avisa os alunos");
    await ana.p.getByLabel(/Pôr os prazos na minha agenda/).click();
    await ana.p.getByText(/Agenda desligada e apagada/).waitFor();
    confere(!(await daTurma()) && sql(`select count(*) from public.agenda_eventos ae join public.turmas t on t.id = ae.turma_id where t.nome = 'Turma A' and t.org_id = (select id from public.organizacoes where slug = '${SLUG}')`) === "0", "agenda: desligar apaga a agenda da conta Google");
    await ana.p.getByRole("button", { name: "Desconectar Google Agenda" }).click();
    await ana.p.getByRole("link", { name: "Conectar Google Agenda" }).waitFor();
    confere(sql(`select count(*) from public.conexoes_google where user_id = '${anaId}'`) === "0", "agenda: desconectar apaga a conexão");
    confere(pediuConfirmacao("Conectar seu Google Agenda?") && pediuConfirmacao("Criar a agenda da turma") && pediuConfirmacao("Convidar os alunos") && pediuConfirmacao("Desligar a agenda") && pediuConfirmacao("Desconectar o Google Agenda?"), "agenda: conectar, criar, convidar, desligar e desconectar pedem confirmação");
  }

  // 7l) Google Drive: os arquivos da turma vão para o Drive de quem ligou
  {
    const GOOGLE = process.env.HANDBACK_GOOGLE_BASE.replace(/\/$/, "");
    const driveFalso = async () => (await fetch(`${GOOGLE}/__drive`)).json();
    const anaId = sql(`select id from auth.users where email = '${ANA}'`);
    const daTurmaA = `from public.arquivos_entrega a join public.entregas e on e.id = a.entrega_id join public.grupos g on g.id = e.grupo_id join public.turmas t on t.id = g.turma_id
      where t.nome = 'Turma A' and t.org_id = (select id from public.organizacoes where slug = '${SLUG}')`;
    const totalA = Number(sql(`select count(*) ${daTurmaA}`));
    await ana.p.goto(`${APP}/app/${SLUG}/configuracoes`);
    await ana.p.getByRole("link", { name: /^Google Drive/ }).click();
    await ana.p.getByRole("heading", { name: "Google Drive", exact: true }).waitFor();
    confere(await ana.p.getByLabel(/Guardar os arquivos no meu Drive/).isDisabled(), "drive: só liga depois de conectar a própria conta");
    const [janelaD] = await Promise.all([ana.p.waitForEvent("popup"), ana.p.getByRole("link", { name: "Conectar Google Drive" }).click()]);
    await ana.p.getByRole("region", { name: "Sua conta Google" }).getByText("professora@gmail.test").waitFor();
    await janelaD.waitForEvent("close", { timeout: 10000 }).catch(() => {});
    confere(sql(`select servico from public.conexoes_google where user_id = '${anaId}'`) === "drive", "drive: conexão própria, só do Drive");
    await ana.p.getByLabel(/Guardar os arquivos no meu Drive/).click();
    await ana.p.getByText(/Ligado\. Os arquivos das entregas vão para a pasta Handback/).waitFor();
    await ana.p.getByLabel(/Levar para o Drive também/).click();
    await ana.p.waitForTimeout(500);
    let noDrive = 0;
    for (let i = 0; i < 60 && noDrive < totalA; i++) {
      noDrive = Number(sql(`select count(*) ${daTurmaA} and a.drive_id is not null`));
      if (noDrive < totalA) await espera(1000);
    }
    confere(totalA > 0 && noDrive === totalA, `drive: os arquivos antigos foram para o Drive (${noDrive} de ${totalA})`);
    confere(sql(`select count(*) ${daTurmaA} and a.caminho is not null`) === "0", "drive: a cópia do Handback é apagada (libera espaço)");
    const arvore = Object.values(await driveFalso());
    const raiz = arvore.find((f) => f.name === "Handback");
    const pastaTurma = arvore.find((f) => f.name === "Turma A");
    const pastaEquipe = arvore.find((f) => f.name === "Equipe Azul");
    confere(Boolean(raiz && pastaTurma && pastaEquipe) && arvore.some((f) => /^\d+ - .+/.test(f.name) && f.tamanho > 0), "drive: pastas Handback › Turma A › Equipe Azul criadas sozinhas, com os arquivos");
    await ana.p.reload();
    confere(await ana.p.getByRole("region", { name: "Arquivos da turma" }).getByText(new RegExp(`${totalA} arquivos? no Drive`)).isVisible(), "drive: a tela mostra quantos estão no Drive");
    await largura(ana.p, "google drive");
    await ana.p.screenshot({ path: `${FOTOS}/51-drive.png`, fullPage: true });

    // Abrir pelo Handback continua funcionando (o Handback busca no Drive)
    const [entregaArq, arqId] = sql(`select e.id || '|' || a.id ${daTurmaA} and a.tipo = 'application/pdf' limit 1`).split("|");
    const abrir = () => ana.p.request.get(`${APP}/app/${SLUG}/entregas/${entregaArq}/arquivo/${arqId}`, { maxRedirects: 0 });
    const resp = await abrir();
    confere(resp.status() === 200 && resp.headers()["content-type"] === "application/pdf" && /sandbox/.test(resp.headers()["content-security-policy"] ?? ""), "drive: o arquivo abre pelo Handback, protegido");
    confere(sql(`select count(*) from public.atividades where acao = 'baixou_arquivo' and descricao like '%(Google Drive)%' and org_id = (select id from public.organizacoes where slug = '${SLUG}')`) !== "0", "drive: abrir do Drive fica no registro");
    const curiosoArq = await curioso.p.request.get(`${APP}/app/${SLUG}/entregas/${entregaArq}/arquivo/${arqId}`, { maxRedirects: 0 });
    confere(curiosoArq.status() === 404, "drive: quem é de fora não abre o arquivo");

    await ana.p.getByRole("button", { name: "Desconectar Google Drive" }).click();
    await ana.p.getByRole("link", { name: "Conectar Google Drive" }).waitFor();
    const depois = await abrir();
    confere(depois.status() === 404 && /conexão foi desfeita/.test(await depois.text()), "drive: depois de desconectar, o Handback avisa que perdeu o acesso");
    confere(pediuConfirmacao("Conectar seu Google Drive?") && pediuConfirmacao("Guardar os arquivos no seu Drive?") && pediuConfirmacao("Levar também os arquivos antigos?") && pediuConfirmacao("Desconectar o Google Drive?"), "drive: conectar, ligar, levar e desconectar pedem confirmação");
  }

  // 7m) Equipes: adicionar pessoa (sozinha ou numa equipe) e criar equipe juntando quem está sozinho
  {
    await ana.p.goto(`${APP}/app/${SLUG}/configuracoes/turmas`);
    await ana.p.locator("summary", { hasText: "+ Criar turma" }).click();
    const formT = ana.p.locator("details", { hasText: "+ Criar turma" });
    await formT.getByLabel("Nome").fill("Projeto Final");
    await formT.getByRole("button", { name: "Criar" }).click();
    await ana.p.getByText("“Projeto Final” criada").waitFor();
    await trocarTurma(ana.p, "Projeto Final");
    await ana.p.goto(`${APP}/app/${SLUG}/grupos`);
    const gaveta = ana.p.getByRole("dialog", { name: "Adicionar pessoa" });
    for (const [nome, email] of [["Lia Prado", "lia@solo.test"], ["Rui Costa", "rui@solo.test"], ["Téo Alves", "teo@solo.test"]]) {
      await ana.p.getByRole("button", { name: "+ Adicionar pessoa" }).click();
      await gaveta.getByLabel("Nome").fill(nome);
      await gaveta.getByLabel("E-mail").fill(email);
      if (nome === "Lia Prado") {
        await largura(ana.p, "adicionar pessoa");
        await ana.p.screenshot({ path: `${FOTOS}/7b-adicionar-pessoa.png` });
      }
      await gaveta.getByRole("button", { name: "Adicionar", exact: true }).click();
      await ana.p.getByText(`${nome} entrou, com entrega individual.`).waitFor();
    }
    confere(pediuConfirmacao("Adicionar Lia Prado?"), "adicionar pessoa pede confirmação");
    confere(await ana.p.getByText("3 cadastros · 3 pessoas").isVisible(), "cada pessoa sozinha vira um cadastro (entrega individual)");
    // Junta duas pessoas sozinhas numa equipe
    await ana.p.getByRole("button", { name: "+ Criar equipe" }).click();
    const ge = ana.p.getByRole("dialog", { name: "Criar equipe" });
    await ge.getByLabel("Nome da equipe").fill("Equipe Sol");
    await ge.getByRole("checkbox", { name: /Lia Prado/ }).check();
    await ge.getByRole("checkbox", { name: /Rui Costa/ }).check();
    await ana.p.screenshot({ path: `${FOTOS}/7c-juntar.png` });
    await ge.getByRole("button", { name: "Criar equipe", exact: true }).click();
    await ana.p.getByText("“Equipe Sol” cadastrado com 2 pessoas.").waitFor();
    confere(pediuConfirmacao("Criar “Equipe Sol”?"), "criar equipe pede confirmação");
    await ana.p.getByText("2 cadastros · 3 pessoas").waitFor({ timeout: 10000 }).catch(() => undefined);
    confere(await ana.p.getByText("2 cadastros · 3 pessoas").isVisible() && await ana.p.getByText("Apagadas (2)").isVisible(), "criar equipe junta quem estava sozinho; os cadastros vazios vão para “Apagadas”");
    // Mais uma pessoa direto na equipe
    await ana.p.getByRole("button", { name: "+ Adicionar pessoa" }).click();
    await gaveta.getByLabel("Nome").fill("Ivo Melo");
    await gaveta.getByLabel("E-mail").fill("ivo@solo.test");
    await gaveta.getByLabel("Em qual equipe ela entra?").selectOption({ label: "Equipe Sol (2 pessoas)" });
    await gaveta.getByRole("button", { name: "Adicionar", exact: true }).click();
    await ana.p.getByText("Ivo Melo entrou em “Equipe Sol”.").waitFor();
    confere(pediuConfirmacao("Adicionar Ivo Melo em “Equipe Sol”?") && await ana.p.getByRole("listitem").filter({ hasText: "Equipe Sol" }).getByText("3 pessoas", { exact: true }).isVisible(), "adicionar pessoa numa equipe que já existe");
    await ana.p.getByRole("button", { name: "+ Adicionar pessoa" }).click();
    await gaveta.getByLabel("Nome").fill("Repetido");
    await gaveta.getByLabel("E-mail").fill("LIA@solo.test");
    await gaveta.getByRole("button", { name: "Adicionar", exact: true }).click();
    await gaveta.getByText(/Esse e-mail já está num cadastro/).waitFor();
    confere(true, "o mesmo e-mail não entra duas vezes");
    await gaveta.getByRole("button", { name: "Fechar" }).click();
    await largura(ana.p, "equipes com os dois botões");
    await ana.p.screenshot({ path: `${FOTOS}/7d-equipes-botoes.png`, fullPage: true });
    // Computador: menu do lado, sem a barra de baixo
    const pc = await navegador.newContext({ viewport: { width: 1280, height: 800 }, storageState: await ana.ctx.storageState() });
    const pp = await pc.newPage();
    await pp.goto(`${APP}/app/${SLUG}/entregas`);
    const lado = pp.getByRole("navigation", { name: "Seções da empresa" });
    const itens = (await lado.getByRole("link").allInnerTexts()).map((x) => x.trim());
    confere(/^Entregas\|(Aulas|Encontros)\|Equipes\|Relatórios\|Moodle\|Configurações$/.test(itens.join("|")) && !(await pp.getByRole("button", { name: "Mais" }).count()), `computador: menu do lado com tudo à vista (${itens.join(", ")})`);
    await pp.screenshot({ path: `${FOTOS}/7e-computador.png` });
    await pc.close();
    await trocarTurma(ana.p, "Turma A");
  }

  // Conta antiga (mais de 14 dias) numa escola que exige: o app autenticador é obrigatório
  {
    const VELHO = `velho-${sufixo}@escola.test`;
    await criarConta(VELHO);
    sql(`update auth.users set created_at = now() - interval '20 days' where email = '${VELHO}'`);
    sql(`insert into public.membros (org_id, user_id, papel) select o.id, u.id, 'avaliador' from public.organizacoes o, auth.users u where o.slug = '${SLUG}' and u.email = '${VELHO}'`);
    const velho = await entrar(navegador, VELHO);
    await velho.p.goto(`${APP}/app/${SLUG}/entregas`);
    await velho.p.waitForURL(/\/conta\/duas-etapas/);
    confere(!(await velho.p.getByRole("link", { name: /Fazer depois/ }).count()), "depois de 14 dias, o código do app passa a ser obrigatório");
    await velho.ctx.close();
  }

  // 7f) Privacidade: o dono não vê o conteúdo; o cliente libera o suporte
  await dono.p.goto(`${APP}/admin`);
  const painelUso = dono.p.getByRole("region", { name: "Uso dos planos" });
  confere(await painelUso.getByText("Arquivos das entregas").isVisible() && (await painelUso.getByRole("meter").count()) === 7, "painel de uso mostra os limites dos planos");
  confere(/\d+ de ~250 · \d+ no mês/.test(await painelUso.locator("li", { hasText: "Análises de IA hoje" }).innerText()), "painel de uso conta as análises de IA");
  const linhaDono = dono.p.locator("li", { hasText: SLUG });
  confere(/entrega\(s\)/.test(await linhaDono.innerText()) && (await linhaDono.innerText()).includes(ANA), "dono vê o espaço na lista, com os números de uso");
  confere(!(await linhaDono.getByRole("link", { name: "Entrar para dar suporte" }).count()), "sem suporte liberado, dono não tem como entrar");
  confere((await dono.p.goto(`${APP}/app/${SLUG}/entregas`)).status() === 404, "dono não abre as entregas do cliente");
  await dono.p.goto(`${APP}/admin`);
  await dono.p.locator("li", { hasText: SLUG }).getByText("Acesso de emergência").click();
  await dono.p.locator("li", { hasText: SLUG }).getByLabel("Motivo (o cliente vai ler)").fill("Teste do acesso de emergência");
  await dono.p.locator("li", { hasText: SLUG }).getByRole("button", { name: "Entrar em emergência e avisar o cliente" }).click();
  await dono.p.getByText(/Conecte o seu Gmail antes|Não entrou/).waitFor();
  confere(true, "emergência só com o cliente avisado por e-mail");
  await largura(dono.p, "administração do Handback");
  await dono.p.screenshot({ path: `${FOTOS}/34-administracao.png`, fullPage: true });

  await ana.p.goto(`${APP}/app/${SLUG}/configuracoes/seguranca`);
  await ana.p.getByRole("button", { name: "Liberar o acesso de suporte" }).click();
  await ana.p.getByText(/Suporte liberado até/).waitFor();
  confere(await ana.p.getByText("O suporte do Handback tem acesso").isVisible(), "o cliente vê no topo que o suporte está aberto");
  await ana.p.screenshot({ path: `${FOTOS}/35-suporte-liberado.png`, fullPage: true });
  await dono.p.goto(`${APP}/admin`);
  await dono.p.locator("li", { hasText: SLUG }).getByRole("link", { name: "Entrar para dar suporte" }).click();
  await dono.p.getByText(/Modo suporte/).waitFor();
  confere(await dono.p.getByRole("link", { name: "Entregas" }).isVisible(), "com suporte liberado, dono entra no espaço");
  await dono.p.getByRole("button", { name: "Sair do suporte" }).click();
  await dono.p.waitForURL(/\/admin$/);
  confere((await dono.p.goto(`${APP}/app/${SLUG}/entregas`)).status() === 404, "depois de sair do suporte, dono não entra mais");
  await ana.p.goto(`${APP}/app/${SLUG}/registro`);
  confere((await ana.p.locator("main ol").innerText()).includes("Liberou o acesso de suporte do Handback por 3 dias"), "liberar o suporte fica no registro");

  // 7g) Cadastro sozinho pela página de vendas
  {
    const NOVA = `nova-${sufixo}@cadastro.test`;
    const ctx = await prepararContexto(navegador, { ...devices["Pixel 7"] });
    const p = await ctx.newPage();
    await p.goto(`${APP}/`);
    await p.getByRole("link", { name: "Criar minha conta grátis" }).first().click();
    await p.waitForURL(/\/criar-conta$/);
    await p.getByLabel("Seu e-mail").fill(NOVA);
    await p.getByRole("button", { name: "Outro" }).click();
    await p.getByLabel("Como você chama o seu espaço?").fill("Mentoria");
    await p.getByLabel("Nome da mentoria").fill(`Mentoria Alfa ${sufixo}`);
    await p.getByRole("checkbox").check();
    await largura(p, "criar minha conta");
    await p.screenshot({ path: `${FOTOS}/36-criar-conta.png`, fullPage: true });
    // Só no teste: zera o limite de cadastros por hora (as rodadas seguidas do teste esbarram nele).
    sql("delete from public.cadastros where criado_em > now() - interval '1 hour' and email like '%@cadastro.test'");
    await p.getByRole("button", { name: "Criar e confirmar e-mail" }).click();
    await p.getByRole("heading", { name: "Confira seu e-mail" }).waitFor();
    confere(true, "cadastro sozinho pede para confirmar o e-mail");
    await ctx.close();
    const nova = await primeiroAcesso(navegador, NOVA);
    await nova.p.waitForURL(/\/comecar$/);
    confere(true, "quem se cadastrou cai no primeiro acesso do próprio espaço");
    await (await menuConta(nova.p)).getByText(/Seu papel: Administrador · Mentoria Alfa/).waitFor();
    confere(true, "quem se cadastrou é administrador do espaço");
    await nova.ctx.close();
    confere(sql(`select vocabulario ->> 'organizacao' || ':' || limite_analises_mes from public.organizacoes where nome = 'Mentoria Alfa ${sufixo}'`) === "Mentoria:200",
      "espaço do cadastro guarda a palavra escolhida e o limite de IA");
  }

  // 8) O dono bloqueia a escola; a Ana vê o aviso
  await dono.p.goto(`${APP}/admin`);
  const linha = dono.p.locator("li", { hasText: SLUG });
  await linha.getByRole("button", { name: "Bloquear" }).click();
  await linha.getByRole("button", { name: "Liberar" }).waitFor();
  await ana.p.goto(`${APP}/app/${SLUG}`);
  confere(await ana.p.getByText(/está bloquead[ao]\. Fale com o suporte/).isVisible(), "Ana vê que a conta foi bloqueada");
  const bloqueada = await chegaEmail({ id: `<b-${sufixo}@aluno>`, assunto: "[ENTREGA] Encontro 2 - Equipe Azul" });
  confere(bloqueada.ok === false && bloqueada.motivo === "empresa bloqueada", "empresa bloqueada não recebe entregas");

  // 9) Sair encerra a sessão
  await ana.p.goto(`${APP}/app`);
  await (await menuConta(ana.p)).getByRole("menuitem", { name: "Sair" }).click();
  await ana.p.waitForURL(`${APP}/`);
  await ana.p.goto(`${APP}/app`);
  confere(new URL(ana.p.url()).pathname === "/entrar", "depois de sair, /app pede login de novo");

  // 10) Link de login com destino externo não leva para fora do site
  const ext = await prepararContexto(navegador, { ...devices["Pixel 7"] });
  const pe = await ext.newPage();
  await pe.goto(`${APP}/auth/confirmar?voltar=//exemplo.com`);
  confere(new URL(pe.url()).host === new URL(APP).host, "link de login não redireciona para outro site");

  // 11) Páginas públicas que o Google exige para a verificação
  await pe.goto(`${APP}/`);
  confere(await pe.getByText(/só a permissão de enviar e-mails/).isVisible(), "página inicial explica o uso do Gmail");
  await largura(pe, "página de vendas");
  await pe.screenshot({ path: `${FOTOS}/25-vendas-pt.png`, fullPage: true });
  for (const [caminho, frase] of [["/en", "we hand it back checked."], ["/es", "nosotros devolvemos revisado."]]) {
    await pe.goto(`${APP}${caminho}`);
    confere(await pe.getByText(frase).isVisible(), `página de vendas em ${caminho}`);
    confere((await pe.locator("[lang]").first().getAttribute("lang")) !== null, `idioma marcado em ${caminho}`);
    await largura(pe, `página de vendas ${caminho}`);
    await pe.screenshot({ path: `${FOTOS}/25-vendas${caminho.replace("/", "-")}.png`, fullPage: true });
  }
  await pe.getByRole("link", { name: "Português" }).click();
  await pe.waitForURL(`${APP}/`);
  confere(true, "troca de idioma volta para o português");
  await pe.goto(`${APP}/`);
  await pe.getByRole("link", { name: "Política de privacidade", exact: true }).click();
  await pe.getByRole("heading", { name: "Política de privacidade", level: 1 }).waitFor();
  confere(await pe.getByText(/including the Limited Use requirements/).isVisible(), "privacidade tem a declaração de Uso Limitado do Google");
  confere(await pe.getByText(/não lê, não apaga, não\s+organiza e não guarda/).isVisible(), "privacidade diz que o Handback não lê o Gmail");
  await largura(pe, "política de privacidade");
  await pe.screenshot({ path: `${FOTOS}/19-privacidade.png`, fullPage: true });
  await pe.goto(`${APP}/termos`);
  confere(await pe.getByRole("heading", { name: "Termos de uso", level: 1 }).isVisible(), "termos de uso abrem sem login");
  await ext.close();

  // Toda ação de adicionar, apagar, conectar, desconectar ou enviar pediu confirmação antes.
  const esperadas = [
    ["Criar “Equipe Azul”?", "criar equipe"],
    ["Adicionar ", "adicionar pessoa ou aula"],
    ["Convidar esta pessoa?", "convidar"],
    ["Criar esta turma?", "criar turma"],
    ["Registrar esta entrega?", "registrar entrega à mão"],
    [/^Analisar \d+ entregas? com a IA\?/, "analisar várias com a IA"],
    ["Conectar seu Gmail?", "conectar o Gmail"],
    [/Enviar a devolutiva|Enviar \d+ devolutiva/, "enviar devolutiva"],
    ["Conectar ao Moodle", "conectar o Moodle"],
    [/^Devolver/, "devolver no Moodle"],
    ["Ligar o lembrete", "ligar lembrete para os alunos"],
    ["Apagar", "apagar"],
    [/^Desligar|Desconectar/, "desconectar"],
    ["Liberar o suporte", "liberar o suporte"],
  ];
  for (const [trecho, oQue] of esperadas) confere(pediuConfirmacao(trecho), `${oQue} pede confirmação antes`);
  if (esperadas.some(([t]) => !pediuConfirmacao(t))) console.log("janelas anotadas:", JSON.stringify(confirmacoes));
} finally {
  await navegador.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES DE PONTA A PONTA PASSARAM");
process.exit(falhas ? 1 : 0);

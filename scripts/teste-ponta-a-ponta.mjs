// Teste de ponta a ponta da Fase 0, com Supabase local (npx supabase start)
// e o app rodando (npm run build && npm start).
//
// Uso: node scripts/teste-ponta-a-ponta.mjs [endereco-do-app] [pasta-das-fotos]
// Precisa do Playwright instalado e do Mailpit do Supabase local (porta 54324).
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  const ctx = await navegador.newContext({ ...devices["Pixel 7"] });
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
  const ctx = await navegador.newContext({ ...devices["Pixel 7"] });
  const p = await ctx.newPage();
  await p.goto(await linkDoEmail(email));
  await p.waitForURL(/\/definir-senha/);
  if (nome) await p.screenshot({ path: `${FOTOS}/${nome}-criar-senha.png`, fullPage: true });
  await p.getByLabel("Nova senha").fill(SENHA);
  await p.getByLabel("Repita a senha").fill(SENHA);
  await p.getByRole("button", { name: "Salvar senha" }).click();
  await p.waitForURL(/\/conta\/duas-etapas/);
  if (nome) await p.screenshot({ path: `${FOTOS}/${nome}-duas-etapas.png`, fullPage: true });
  await cadastrarCelular(p, email);
  await p.waitForURL(/\/app/);
  return { ctx, p };
}

async function largura(p, oQue) {
  const w = await p.evaluate(() => document.documentElement.scrollWidth);
  confere(w <= 412, `${oQue} cabe no celular (${w}px)`);
}

const navegador = await chromium.launch();
try {
  // 1) Área protegida sem login → vai para /entrar
  {
    const ctx = await navegador.newContext();
    const p = await ctx.newPage();
    await p.goto(`${APP}/app`);
    confere(new URL(p.url()).pathname === "/entrar", "sem login, /app manda para /entrar");
    await p.goto(`${APP}/admin`);
    confere(new URL(p.url()).pathname === "/entrar", "sem login, /admin manda para /entrar");
    await ctx.close();
  }

  // 2) Ninguém cria conta sozinho; senha errada não entra. O dono entra; ainda não é dono da plataforma
  {
    const ctx = await navegador.newContext({ ...devices["Pixel 7"] });
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
    const ctx = await navegador.newContext({ ...devices["Pixel 7"] });
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
  confere(await dono.p.getByText("Você ainda não faz parte de nenhuma empresa").isVisible(), "dono novo vê lista vazia");
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
  confere(await dono.p.getByRole("link", { name: "Painel do dono" }).isVisible(), "aparece o Painel do dono");

  // 4) Cria a empresa e convida a Ana
  await dono.p.goto(`${APP}/admin`);
  await dono.p.getByLabel("Nome da empresa").fill("Escola Alfa");
  await dono.p.getByLabel("Endereço no Handback").fill(SLUG);
  await dono.p.getByLabel("Tipo de empresa").selectOption("educacao");
  await dono.p.getByLabel("E-mail do administrador da empresa").fill(ANA.toUpperCase());
  await dono.p.getByRole("button", { name: "Criar empresa" }).click();
  await dono.p.getByText(/Empresa "Escola Alfa" criada/).waitFor();
  confere(true, "empresa criada pelo painel");
  await largura(dono.p, "painel do dono");
  await dono.p.screenshot({ path: `${FOTOS}/2-painel-do-dono.png`, fullPage: true });

  // 5) Endereço repetido é recusado com mensagem clara
  await dono.p.getByLabel("Nome da empresa").fill("Outra");
  await dono.p.getByLabel("Endereço no Handback").fill(SLUG);
  await dono.p.getByLabel("Tipo de empresa").selectOption("empresa");
  await dono.p.getByRole("button", { name: "Criar empresa" }).click();
  await dono.p.getByText("Já existe uma empresa com o endereço").waitFor();
  confere(true, "endereço repetido é recusado");

  // 6) Ana entra e já é administradora da escola
  const ana = await primeiroAcesso(navegador, ANA, "3-ana");
  confere(true, "Ana recebe o convite, cria a senha e ativa as duas etapas");
  {
    // Senha fraca e senha diferente são recusadas (outro link de "esqueci a senha" não é preciso: testa na própria tela).
    const ctx = await navegador.newContext({ ...devices["Pixel 7"] });
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
  confere(await ana.p.getByText("Educação · Administrador").isVisible(), "Ana é administradora");
  await largura(ana.p, "minhas empresas");
  await ana.p.screenshot({ path: `${FOTOS}/4-minhas-empresas.png`, fullPage: true });
  await ana.p.getByText("Escola Alfa").click();
  await ana.p.waitForURL(new RegExp(`/app/${SLUG}$`));
  const abasAna = await ana.p.getByRole("navigation", { name: "Seções da empresa" }).getByRole("link").allInnerTexts();
  confere(abasAna.join("|") === "Visão geral|Entregas|Aulas|Equipes|Pessoas|Ajustes|Registro", `vocabulário de escola nas abas (${abasAna.join(", ")})`);
  await largura(ana.p, "painel da empresa");
  await ana.p.screenshot({ path: `${FOTOS}/5-painel-da-empresa.png`, fullPage: true });
  confere((await ana.p.goto(`${APP}/admin`)).status() === 404, "Ana não abre o Painel do dono");

  // 7) Um curioso não vê a escola nem pelo endereço direto
  await criarConta(CURIOSO);
  const curioso = await entrar(navegador, CURIOSO);
  confere(await curioso.p.getByText("Você ainda não faz parte de nenhuma empresa").isVisible(), "curioso não vê empresas");
  {
    // "Esqueci minha senha": link por e-mail → senha nova (senha fraca é recusada).
    const ESQUECIDO = `esquecido-${sufixo}@qualquer.test`;
    await criarConta(ESQUECIDO);
    const ctx = await navegador.newContext({ ...devices["Pixel 7"] });
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
    const ctx = await navegador.newContext({ ...devices["Pixel 7"] });
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

  // F3) Equipes com e-mails; e-mail repetido em outra equipe é recusado
  await ana.p.goto(`${APP}/app/${SLUG}/grupos`);
  await ana.p.getByLabel("Nome", { exact: true }).fill("Equipe Azul");
  await ana.p.getByLabel("E-mails de quem entrega").fill("a1@aluno.test, A2@Aluno.test; a1@aluno.test");
  await ana.p.getByRole("button", { name: "Adicionar" }).click();
  await ana.p.getByText("“Equipe Azul” cadastrado com 2 e-mail(s).").waitFor();
  confere(await ana.p.getByText("a1@aluno.test, a2@aluno.test").isVisible(), "e-mails guardados em minúsculas e sem repetição");
  confere((await ana.p.getByLabel("Nome", { exact: true }).inputValue()) === "", "formulário de equipe limpa depois de salvar");
  await ana.p.getByLabel("Nome", { exact: true }).fill("Equipe Verde");
  await ana.p.getByLabel("E-mails de quem entrega").fill("a1@aluno.test");
  await ana.p.getByRole("button", { name: "Adicionar" }).click();
  await ana.p.getByText(/a1@aluno.test \(já está em “Equipe Azul”\)/).waitFor();
  confere(true, "o mesmo e-mail não entra em duas equipes");
  await ana.p.getByLabel("E-mails de quem entrega").fill("v1@aluno.test, nao-e-email");
  await ana.p.getByRole("button", { name: "Adicionar" }).click();
  await ana.p.getByText("Estes e-mails não parecem válidos: nao-e-email.").waitFor();
  confere(true, "e-mail inválido é apontado");
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
  await prof.p.getByText("Escola Alfa").click();
  await prof.p.waitForURL(new RegExp(`/app/${SLUG}$`));
  const abas = await prof.p.getByRole("navigation", { name: "Seções da empresa" }).getByRole("link").allInnerTexts();
  confere(abas.join("|") === "Visão geral|Entregas|Aulas|Equipes", `professor vê as abas certas (${abas.join(", ")})`);
  confere(await prof.p.getByText("Seu papel: Avaliador").isVisible(), "papel de avaliador");
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
  confere(await prof.p.getByText("a1@aluno.test, a2@aluno.test").isVisible(), "professor vê os e-mails das equipes");
  await prof.p.screenshot({ path: `${FOTOS}/9-professor.png`, fullPage: true });

  // F6) Ana troca o vocabulário: Aula → Encontro
  await ana.p.goto(`${APP}/app/${SLUG}/ajustes`);
  await ana.p.getByLabel("Etapa (uma)").fill("Encontro");
  await ana.p.getByLabel("Etapas (várias)").fill("Encontros");
  await ana.p.getByRole("button", { name: "Salvar ajustes" }).click();
  await ana.p.getByText("Ajustes salvos.").waitFor();
  await ana.p.goto(`${APP}/app/${SLUG}`);
  confere(await ana.p.getByRole("link", { name: "Encontros" }).first().isVisible(), "aba passa a se chamar Encontros");
  confere(await ana.p.getByText("Encontro 1 · Diagnóstico").isVisible(), "visão geral mostra o próximo prazo com a palavra nova");
  await ana.p.screenshot({ path: `${FOTOS}/10-visao-geral.png`, fullPage: true });

  // F7) Ana tira um e-mail da equipe e apaga a aula
  await ana.p.goto(`${APP}/app/${SLUG}/grupos`);
  await ana.p.getByText("Equipe Azul").click();
  await ana.p.waitForURL(/\/grupos\/[0-9a-f-]{36}$/);
  await ana.p.getByLabel("E-mails de quem entrega").fill("a1@aluno.test");
  await ana.p.getByRole("button", { name: "Salvar alterações" }).click();
  await ana.p.getByText("Alterações salvas.").waitFor();
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
  await ana.p.goto(`${APP}/app/${SLUG}/ajustes`);
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
  await ana.p.getByLabel("Nome", { exact: true }).fill("Equipe Roxa");
  await ana.p.getByRole("button", { name: "Adicionar" }).click();
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
  await ana.p.getByText("Para revisar", { exact: true }).first().waitFor({ timeout: 60000 });
  await ana.p.waitForFunction(() => document.querySelectorAll("li").length && ![...document.querySelectorAll("button")].some((b) => /Analisando/.test(b.textContent)), null, { timeout: 60000 });
  await ana.p.reload();
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
  confere(await ana.p.getByText("professora@gmail.test").isVisible(), "painel mostra o Gmail conectado");
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
  await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
  await ana.p.getByRole("button", { name: "Desconectar" }).click();
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
    const ctx = await navegador.newContext({ ...devices["Pixel 7"] });
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

  // 8) O dono bloqueia a escola; a Ana vê o aviso
  await dono.p.goto(`${APP}/admin`);
  const linha = dono.p.locator("li", { hasText: SLUG });
  await linha.getByRole("button", { name: "Bloquear" }).click();
  await linha.getByRole("button", { name: "Liberar" }).waitFor();
  await ana.p.goto(`${APP}/app/${SLUG}`);
  confere(await ana.p.getByText("Esta empresa está bloqueada").isVisible(), "Ana vê que a empresa foi bloqueada");
  const bloqueada = await chegaEmail({ id: `<b-${sufixo}@aluno>`, assunto: "[ENTREGA] Encontro 2 - Equipe Azul" });
  confere(bloqueada.ok === false && bloqueada.motivo === "empresa bloqueada", "empresa bloqueada não recebe entregas");

  // 9) Sair encerra a sessão
  await ana.p.goto(`${APP}/app`);
  await ana.p.getByRole("button", { name: "Sair" }).click();
  await ana.p.waitForURL(`${APP}/`);
  await ana.p.goto(`${APP}/app`);
  confere(new URL(ana.p.url()).pathname === "/entrar", "depois de sair, /app pede login de novo");

  // 10) Link de login com destino externo não leva para fora do site
  const ext = await navegador.newContext({ ...devices["Pixel 7"] });
  const pe = await ext.newPage();
  await pe.goto(`${APP}/auth/confirmar?voltar=//exemplo.com`);
  confere(new URL(pe.url()).host === new URL(APP).host, "link de login não redireciona para outro site");

  // 11) Páginas públicas que o Google exige para a verificação
  await pe.goto(`${APP}/`);
  confere(await pe.getByText("só a permissão de enviar e-mails").isVisible(), "página inicial explica o uso do Gmail");
  await pe.getByRole("link", { name: "Política de privacidade" }).click();
  await pe.getByRole("heading", { name: "Política de privacidade", level: 1 }).waitFor();
  confere(await pe.getByText(/including the Limited Use requirements/).isVisible(), "privacidade tem a declaração de Uso Limitado do Google");
  confere(await pe.getByText(/não lê, não apaga, não\s+organiza e não guarda/).isVisible(), "privacidade diz que o Handback não lê o Gmail");
  await largura(pe, "política de privacidade");
  await pe.screenshot({ path: `${FOTOS}/19-privacidade.png`, fullPage: true });
  await pe.goto(`${APP}/termos`);
  confere(await pe.getByRole("heading", { name: "Termos de uso", level: 1 }).isVisible(), "termos de uso abrem sem login");
  await ext.close();
} finally {
  await navegador.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES DE PONTA A PONTA PASSARAM");
process.exit(falhas ? 1 : 0);

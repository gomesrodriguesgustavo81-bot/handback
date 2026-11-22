// Teste de ponta a ponta da Fase 0, com Supabase local (npx supabase start)
// e o app rodando (npm run build && npm start).
//
// Uso: node scripts/teste-ponta-a-ponta.mjs [endereco-do-app] [pasta-das-fotos]
// Precisa do Playwright instalado e do Mailpit do Supabase local (porta 54324).
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
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
      const link = (m.Text.match(/https?:\/\/\S+/) ?? [])[0];
      if (link) return link.replace(/[)>\]]+$/, "");
    }
    await espera(500);
  }
  throw new Error(`Nenhum e-mail chegou para ${email}`);
}

async function entrar(navegador, email, nome) {
  const ctx = await navegador.newContext({ ...devices["Pixel 7"] });
  const p = await ctx.newPage();
  await p.goto(`${APP}/entrar`);
  await p.getByLabel("Seu e-mail").fill(email);
  await p.getByRole("button", { name: "Receber link de acesso" }).click();
  await p.getByText("Enviamos um link de acesso").waitFor();
  if (nome) await p.screenshot({ path: `${FOTOS}/${nome}-link-enviado.png`, fullPage: true });
  await p.goto(await linkDoEmail(email));
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

  // 2) O dono entra; ainda não é dono da plataforma
  const dono = await entrar(navegador, DONO, "1-dono");
  confere(await dono.p.getByText("Você ainda não faz parte de nenhuma empresa").isVisible(), "dono novo vê lista vazia");
  const r = await dono.p.goto(`${APP}/admin`);
  confere(r.status() === 404, "antes de virar dono, /admin não existe para ele");

  // 3) Vira dono da plataforma (como no passo a passo do docs/)
  execFileSync("psql", [DB, "-qc",
    `insert into public.administradores_plataforma (user_id) select id from auth.users where email = '${DONO}'`]);
  await dono.p.goto(`${APP}/app`);
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
  const ana = await entrar(navegador, ANA, "3-ana");
  confere(await ana.p.getByText("Escola Alfa").isVisible(), "Ana vê a Escola Alfa");
  confere(await ana.p.getByText("Educação · Administrador").isVisible(), "Ana é administradora");
  await largura(ana.p, "minhas empresas");
  await ana.p.screenshot({ path: `${FOTOS}/4-minhas-empresas.png`, fullPage: true });
  await ana.p.getByText("Escola Alfa").click();
  await ana.p.waitForURL(new RegExp(`/app/${SLUG}$`));
  confere(await ana.p.getByText("Professor", { exact: true }).isVisible(), "vocabulário de escola (Professor)");
  confere(await ana.p.getByText("Aula", { exact: true }).isVisible(), "vocabulário de escola (Aula)");
  await largura(ana.p, "painel da empresa");
  await ana.p.screenshot({ path: `${FOTOS}/5-painel-da-empresa.png`, fullPage: true });
  confere((await ana.p.goto(`${APP}/admin`)).status() === 404, "Ana não abre o Painel do dono");

  // 7) Um curioso não vê a escola nem pelo endereço direto
  const curioso = await entrar(navegador, CURIOSO);
  confere(await curioso.p.getByText("Você ainda não faz parte de nenhuma empresa").isVisible(), "curioso não vê empresas");
  confere((await curioso.p.goto(`${APP}/app/${SLUG}`)).status() === 404, "curioso não abre a escola pelo endereço");

  // 8) O dono bloqueia a escola; a Ana vê o aviso
  await dono.p.goto(`${APP}/admin`);
  const linha = dono.p.locator("li", { hasText: SLUG });
  await linha.getByRole("button", { name: "Bloquear" }).click();
  await linha.getByRole("button", { name: "Liberar" }).waitFor();
  await ana.p.goto(`${APP}/app/${SLUG}`);
  confere(await ana.p.getByText("Esta empresa está bloqueada").isVisible(), "Ana vê que a empresa foi bloqueada");

  // 9) Sair encerra a sessão
  await ana.p.goto(`${APP}/app`);
  await ana.p.getByRole("button", { name: "Sair" }).click();
  await ana.p.waitForURL(`${APP}/`);
  await ana.p.goto(`${APP}/app`);
  confere(new URL(ana.p.url()).pathname === "/entrar", "depois de sair, /app pede login de novo");

  // 10) Link de login com destino externo não leva para fora do site
  const ext = await navegador.newContext();
  const pe = await ext.newPage();
  await pe.goto(`${APP}/auth/confirmar?voltar=//exemplo.com`);
  confere(new URL(pe.url()).host === new URL(APP).host, "link de login não redireciona para outro site");
  await ext.close();
} finally {
  await navegador.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES DE PONTA A PONTA PASSARAM");
process.exit(falhas ? 1 : 0);

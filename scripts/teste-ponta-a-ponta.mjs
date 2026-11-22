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
  const abasAna = await ana.p.getByRole("navigation", { name: "Seções da empresa" }).getByRole("link").allInnerTexts();
  confere(abasAna.join("|") === "Visão geral|Aulas|Equipes|Pessoas|Ajustes", `vocabulário de escola nas abas (${abasAna.join(", ")})`);
  await largura(ana.p, "painel da empresa");
  await ana.p.screenshot({ path: `${FOTOS}/5-painel-da-empresa.png`, fullPage: true });
  confere((await ana.p.goto(`${APP}/admin`)).status() === 404, "Ana não abre o Painel do dono");

  // 7) Um curioso não vê a escola nem pelo endereço direto
  const curioso = await entrar(navegador, CURIOSO);
  confere(await curioso.p.getByText("Você ainda não faz parte de nenhuma empresa").isVisible(), "curioso não vê empresas");
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
  await ana.p.getByText(`Peça para ${PROF} entrar`).waitFor();
  confere(await ana.p.getByText("Convites aguardando (1)").isVisible(), "convite aparece na lista");
  await largura(ana.p, "pessoas");
  await ana.p.screenshot({ path: `${FOTOS}/8-pessoas.png`, fullPage: true });

  // F5) Professor entra: vê aulas e equipes, sem editar; não vê Pessoas nem Ajustes
  const prof = await entrar(navegador, PROF);
  await prof.p.getByText("Escola Alfa").click();
  await prof.p.waitForURL(new RegExp(`/app/${SLUG}$`));
  const abas = await prof.p.getByRole("navigation", { name: "Seções da empresa" }).getByRole("link").allInnerTexts();
  confere(abas.join("|") === "Visão geral|Aulas|Equipes", `professor vê as abas certas (${abas.join(", ")})`);
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

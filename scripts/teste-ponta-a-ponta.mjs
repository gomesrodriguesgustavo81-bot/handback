// Teste de ponta a ponta da Fase 0, com Supabase local (npx supabase start)
// e o app rodando (npm run build && npm start).
//
// Uso: node scripts/teste-ponta-a-ponta.mjs [endereco-do-app] [pasta-das-fotos]
// Precisa do Playwright instalado e do Mailpit do Supabase local (porta 54324).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
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
  confere(abasAna.join("|") === "Visão geral|Entregas|Aulas|Equipes|Pessoas|Ajustes", `vocabulário de escola nas abas (${abasAna.join(", ")})`);
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
  await ana.p.getByText("Como ligar o encaminhamento no Gmail").click();
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
  const baixado = await ana.p.request.get(href);
  confere(baixado.status() === 200 && (await baixado.text()) === "conteudo do relatorio", "anexo do e-mail é baixado da área privada");
  await ana.p.screenshot({ path: `${FOTOS}/13-detalhe-entrega.png`, fullPage: true });

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
  confere((await prof.p.request.get(hrefProf)).status() === 200, "professor baixa o anexo");
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
  confere(dobra.devolutiva < dobra.alto && dobra.checklist < dobra.alto, "conceito, devolutiva e checklist aparecem sem rolar");
  confere(await ana.p.getByRole("button", { name: "Aprovar devolutiva" }).isVisible(), "botão Aprovar sempre visível no rodapé");
  await ana.p.getByText("Detalhes da análise").click();
  confere(await ana.p.getByText(/gemini-flash-latest/).isVisible(), "mostra o modelo usado");
  await largura(ana.p, "análise e devolutiva");
  await ana.p.screenshot({ path: `${FOTOS}/15-analise.png`, fullPage: true });

  // Revisão: muda o conceito, edita, salva rascunho, aprova, reabre, aprova de novo.
  await ana.p.getByRole("radio", { name: "BOM", exact: true }).click();
  await ana.p.getByLabel(/^Devolutiva para/).fill("Pessoal, ótima entrega! Ajustem o roteiro de teste e seguimos.");
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
  confere(await ana.p.getByRole("link", { name: /Seguinte →|Voltar ao painel/ }).isVisible(), "depois de aprovar, ir para a próxima");
  await ana.p.getByRole("button", { name: "Reabrir para editar" }).click();
  await ana.p.getByRole("button", { name: "Aprovar devolutiva" }).waitFor();
  await ana.p.getByRole("button", { name: "Aprovar devolutiva" }).click();
  await ana.p.getByText("Aprovada · BOM").waitFor();
  confere(true, "reabrir e aprovar de novo");
  await ana.p.screenshot({ path: `${FOTOS}/16-devolutiva-aprovada.png`, fullPage: true });
  await ana.p.goto(`${APP}/app/${SLUG}/entregas`);
  confere((await ana.p.locator("dl div", { hasText: "Aprovadas" }).innerText()).includes("1"), "painel conta as devolutivas aprovadas");
  const cartaoAzul = ana.p.getByRole("link", { name: /Equipe Azul/ });
  confere((await cartaoAzul.getByText("Aprovada", { exact: true }).isVisible()) && (await cartaoAzul.getByText("BOM", { exact: true }).isVisible()), "painel mostra o conceito aprovado");
  await ana.p.getByRole("link", { name: /^Aprovadas/ }).click();
  await ana.p.waitForURL(/filtro=aprovadas/);
  confere((await ana.p.evaluate(() => [...document.querySelectorAll("main a")].filter((a) => /\/entregas\/[0-9a-f-]{36}$/.test(a.getAttribute("href"))).length)) === 1, "filtro Aprovadas mostra só a aprovada");

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
  confere(true, "falha da IA aparece com mensagem clara");
  await ana.p.reload();
  confere(await ana.p.getByRole("button", { name: "Tentar de novo" }).isVisible(), "dá para tentar de novo depois da falha");

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

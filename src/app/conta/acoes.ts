"use server";

import { redirect } from "next/navigation";
import { marcarSenhaDefinida } from "@/lib/acesso";
import { caminhoSeguro } from "@/lib/caminhos";
import { sessaoBasica } from "@/lib/sessao";
import { problemaNaSenha, senhaVazada } from "@/lib/senha";
import { criarClienteServidor } from "@/lib/supabase/server";
import { registrarAcesso } from "@/lib/registro";
import { VERSAO_TERMOS } from "@/lib/termos";
import { createClient } from "@supabase/supabase-js";
import { lerConfigSupabase } from "@/lib/supabase/config";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { contarSenhaErrada, mensagemDeTrava, minutosDeTrava, zerarTentativas } from "@/lib/tentativas";
import { guardarSenhaNova, senhaJaUsada } from "@/lib/senhas-antigas";
import { gerarCodigos, usarCodigo } from "@/lib/recuperacao";
import { avisarSeguranca } from "@/lib/emails/seguranca";

export type Estado = { ok: boolean; mensagem: string } | null;

const CODIGO = /^\d{6}$/;

/** Cria (ou troca) a senha. Se a pessoa já tem as 2 etapas, exige o código antes. */
export async function definirSenha(_a: Estado, dados: FormData): Promise<Estado> {
  const s = await sessaoBasica();
  if (s.temSegundaEtapa && s.nivel !== "aal2") redirect("/entrar/codigo?voltar=/definir-senha");
  const senha = String(dados.get("senha") ?? "");
  const repetir = String(dados.get("repetir") ?? "");
  // Primeira senha = primeiro acesso: é aqui que a pessoa aceita os Termos (convidados também).
  if (!s.senhaDefinida && dados.get("aceito") !== "on") return { ok: false, mensagem: "Para continuar, aceite os Termos de uso e a Política de privacidade." };
  const problema = problemaNaSenha(senha, s.email);
  if (problema) return { ok: false, mensagem: problema };
  if (senha !== repetir) return { ok: false, mensagem: "As duas senhas não são iguais." };
  // Trocar a senha (não é o primeiro acesso nem o "esqueci"): pede a senha de agora, que também tem limite de tentativas.
  if (s.senhaDefinida && s.viaSenha) {
    const travado = await minutosDeTrava(s.email, "troca");
    if (travado > 0) return { ok: false, mensagem: mensagemDeTrava(travado) };
    const atual = String(dados.get("atual") ?? "");
    if (!atual) return { ok: false, mensagem: "Digite a senha de agora para trocar." };
    const config = lerConfigSupabase();
    if (!config) return { ok: false, mensagem: "O banco de dados ainda não foi ligado." };
    // Cliente à parte, sem guardar sessão: só confere a senha, sem mexer no login atual.
    const { error: erroAtual } = await createClient(config.url, config.chave, { auth: { persistSession: false, autoRefreshToken: false } }).auth.signInWithPassword({
      email: s.email,
      password: atual,
    });
    if (erroAtual) {
      const trava = await contarSenhaErrada(s.email, "troca");
      return { ok: false, mensagem: trava > 0 ? mensagemDeTrava(trava) : "A senha de agora está incorreta." };
    }
    await zerarTentativas(s.email, "troca");
  }
  if (await senhaVazada(senha)) {
    return { ok: false, mensagem: "Essa senha já apareceu em vazamentos de dados na internet. Escolha outra." };
  }
  // Nome que aparece nos e-mails para os alunos (pedido no primeiro acesso).
  const nome = String(dados.get("nome") ?? "").trim().replace(/\s+/g, " ");
  if (dados.has("nome") && (nome.length < 2 || nome.length > 80)) return { ok: false, mensagem: "Escreva seu nome (de 2 a 80 letras)." };
  const supabase = await criarClienteServidor();
  // Quem administra não repete uma das últimas 5 senhas.
  const adminDb = criarClienteAdmin();
  const { data: eAdministrador } = await supabase.rpc("e_quem_administra");
  if (eAdministrador === true && adminDb && (await senhaJaUsada(adminDb, s.id, senha))) {
    return { ok: false, mensagem: "Essa senha já foi usada antes. Escolha uma diferente das últimas 5." };
  }
  const { error } = await supabase.auth.updateUser({ password: senha, ...(nome ? { data: { nome } } : {}) });
  if (error && !/same|different from the old/i.test(error.message)) {
    return { ok: false, mensagem: /weak|short|characters/i.test(error.message) ? "Senha fraca: use 8 ou mais caracteres, com maiúscula, minúscula, número e caractere especial." : "Não foi possível salvar a senha. Tente de novo." };
  }
  if (!(await marcarSenhaDefinida(s.id))) return { ok: false, mensagem: "Não foi possível salvar a senha. Tente de novo." };
  // Recarrega a sessão para o servidor enxergar a marca nova.
  await supabase.auth.refreshSession();
  if (adminDb) await guardarSenhaNova(adminDb, s.id, senha).catch(() => undefined);
  if (s.senhaDefinida) {
    // Trocou a senha: derruba os outros aparelhos e avisa por e-mail.
    await supabase.auth.signOut({ scope: "others" });
    await avisarSeguranca(s.email, "senha-trocada");
  }
  if (dados.get("aceito") === "on") {
    const { error: erroAceite } = await supabase.rpc("registrar_aceite", { p_versao: VERSAO_TERMOS, p_origem: "senha" });
    if (erroAceite) console.error("[aceite]", erroAceite.message);
  }
  await supabase.rpc("aceitar_convites");
  await registrarAcesso(supabase, s.senhaDefinida ? "trocou_senha" : "criou_senha");
  redirect("/app");
}

async function fatorDoApp() {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.auth.mfa.listFactors();
  return { supabase, fatores: data?.totp ?? [], todos: data?.all ?? [] };
}

/** Segunda etapa no login: confere o código de 6 números do app autenticador. */
export async function conferirCodigo(_a: Estado, dados: FormData): Promise<Estado> {
  const codigo = String(dados.get("codigo") ?? "").replace(/\s/g, "");
  const voltar = caminhoSeguro(dados.get("voltar"));
  if (!CODIGO.test(codigo)) return { ok: false, mensagem: "Digite os 6 números que aparecem no app." };
  const { supabase, fatores } = await fatorDoApp();
  const fator = fatores.find((f) => f.status === "verified");
  if (!fator) redirect("/conta/duas-etapas");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo });
  if (error) {
    return {
      ok: false,
      mensagem: error.status === 429 ? "Muitas tentativas. Espere um pouco." : "Código incorreto ou vencido. Confira o app e tente de novo.",
    };
  }
  await registrarAcesso(supabase, "confirmou_codigo");
  redirect(voltar);
}

/** Começa o cadastro do app autenticador: devolve o QR code e a chave para digitar. */
export async function comecarDuasEtapas(): Promise<{ ok: true; id: string; qr: string; chave: string } | { ok: false; mensagem: string }> {
  await sessaoBasica();
  const { supabase, todos } = await fatorDoApp();
  // Apaga cadastros que ficaram pela metade.
  for (const f of todos.filter((x) => x.status === "unverified")) await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Handback",
    friendlyName: `Celular ${new Date().toISOString().slice(0, 19)}`,
  });
  if (error || !data) return { ok: false, mensagem: "Não foi possível começar agora. Tente de novo." };
  return { ok: true, id: data.id, qr: data.totp.qr_code, chave: data.totp.secret };
}

/** Termina o cadastro com o primeiro código. Ao trocar de celular, remove o anterior. */
export async function confirmarDuasEtapas(factorId: string, _a: Estado, dados: FormData): Promise<Estado> {
  const codigo = String(dados.get("codigo") ?? "").replace(/\s/g, "");
  if (!CODIGO.test(codigo)) return { ok: false, mensagem: "Digite os 6 números que aparecem no app." };
  const { supabase } = await fatorDoApp();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: codigo });
  if (error) return { ok: false, mensagem: "Código incorreto ou vencido. Confira o app e tente de novo." };
  const { fatores } = await fatorDoApp();
  const antigos = fatores.filter((x) => x.status === "verified" && x.id !== factorId);
  for (const f of antigos) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  await registrarAcesso(supabase, antigos.length ? "trocou_celular" : "ativou_duas_etapas");
  if (antigos.length) {
    const { data: u } = await supabase.auth.getUser();
    if (u.user?.email) await avisarSeguranca(u.user.email, "duas-etapas-trocada");
  }
  redirect("/app?duas-etapas=ok");
}

/** Encerra a sessão em todos os aparelhos (útil se perder o celular ou o computador). */
export async function sairDeTodos(): Promise<void> {
  const supabase = await criarClienteServidor();
  await registrarAcesso(supabase, "saiu_de_todos");
  await supabase.auth.signOut({ scope: "global" });
  redirect("/entrar");
}

/** Nome nos e-mails e cópia das devolutivas (cada pessoa decide o seu). */
export async function salvarPreferenciasDeEnvio(_a: Estado, dados: FormData): Promise<Estado> {
  await sessaoBasica();
  const nome = String(dados.get("nome") ?? "").trim().replace(/\s+/g, " ");
  if (nome.length < 2 || nome.length > 80) return { ok: false, mensagem: "Escreva seu nome (de 2 a 80 letras)." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.updateUser({ data: { nome, copia_devolutiva: dados.get("copia") === "sim" } });
  if (error) return { ok: false, mensagem: "Não foi possível salvar. Tente de novo." };
  return { ok: true, mensagem: "Salvo." };
}

/**
 * Verificação de vazamento sem mandar a senha: o aparelho manda só os 5 primeiros
 * caracteres do resumo SHA-1 e compara o resto aqui na tela. Devolve a lista pública
 * "Have I Been Pwned" daquela faixa (sufixo:vezes, uma por linha). Falhou? Lista vazia.
 */
export async function faixaDeSenhasVazadas(prefixo: string): Promise<string> {
  if (!/^[0-9A-F]{5}$/.test(prefixo)) return "";
  try {
    const r = await fetch(`https://api.pwnedpasswords.com/range/${prefixo}`, {
      headers: { "add-padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  }
}

/** Gera 8 códigos de recuperação novos (os antigos deixam de valer) e mostra uma única vez. */
export async function gerarCodigosDeRecuperacao(): Promise<{ ok: true; codigos: string[] } | { ok: false; mensagem: string }> {
  const s = await sessaoBasica();
  if (!s.temSegundaEtapa || s.nivel !== "aal2") return { ok: false, mensagem: "Entre com o código do celular antes de gerar os códigos." };
  const admin = criarClienteAdmin();
  if (!admin) return { ok: false, mensagem: "O servidor ainda não está pronto." };
  try {
    const codigos = await gerarCodigos(admin, s.id);
    const supabase = await criarClienteServidor();
    await registrarAcesso(supabase, "gerou_codigos_recuperacao");
    await avisarSeguranca(s.email, "codigos-gerados");
    return { ok: true, codigos };
  } catch {
    return { ok: false, mensagem: "Não foi possível gerar agora. Tente de novo." };
  }
}

/**
 * Perdeu o celular: com a senha (já digitada) e um código de recuperação, desliga a verificação
 * em duas etapas para cadastrar o celular novo. Cada código vale uma vez; erros travam como a senha.
 */
export async function usarCodigoDeRecuperacao(_a: Estado, dados: FormData): Promise<Estado> {
  const s = await sessaoBasica();
  if (!s.temSegundaEtapa) redirect("/conta/duas-etapas");
  if (s.nivel === "aal2") redirect("/conta");
  const travado = await minutosDeTrava(s.email, "recuperar");
  if (travado > 0) return { ok: false, mensagem: mensagemDeTrava(travado) };
  const admin = criarClienteAdmin();
  if (!admin) return { ok: false, mensagem: "O servidor ainda não está pronto." };
  const valeu = await usarCodigo(admin, s.id, String(dados.get("codigo") ?? ""));
  if (!valeu) {
    const trava = await contarSenhaErrada(s.email, "recuperar");
    return { ok: false, mensagem: trava > 0 ? mensagemDeTrava(trava) : "Esse código não vale (já foi usado ou está errado)." };
  }
  await zerarTentativas(s.email, "recuperar");
  const { data: lista } = await admin.auth.admin.mfa.listFactors({ userId: s.id });
  for (const f of lista?.factors ?? []) await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: s.id });
  const supabase = await criarClienteServidor();
  await registrarAcesso(supabase, "usou_codigo_recuperacao");
  await avisarSeguranca(s.email, "duas-etapas-removida");
  await supabase.auth.refreshSession();
  redirect("/conta/duas-etapas");
}

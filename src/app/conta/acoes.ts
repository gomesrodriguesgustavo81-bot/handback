"use server";

import { redirect } from "next/navigation";
import { marcarSenhaDefinida } from "@/lib/acesso";
import { caminhoSeguro } from "@/lib/caminhos";
import { sessaoBasica } from "@/lib/sessao";
import { problemaNaSenha, senhaVazada } from "@/lib/senha";
import { criarClienteServidor } from "@/lib/supabase/server";

export type Estado = { ok: boolean; mensagem: string } | null;

const CODIGO = /^\d{6}$/;

/** Cria (ou troca) a senha. Se a pessoa já tem as 2 etapas, exige o código antes. */
export async function definirSenha(_a: Estado, dados: FormData): Promise<Estado> {
  const s = await sessaoBasica();
  if (s.temSegundaEtapa && s.nivel !== "aal2") redirect("/entrar/codigo?voltar=/definir-senha");
  const senha = String(dados.get("senha") ?? "");
  const repetir = String(dados.get("repetir") ?? "");
  const problema = problemaNaSenha(senha, s.email);
  if (problema) return { ok: false, mensagem: problema };
  if (senha !== repetir) return { ok: false, mensagem: "As duas senhas não são iguais." };
  if (await senhaVazada(senha)) {
    return { ok: false, mensagem: "Essa senha já apareceu em vazamentos de dados na internet. Escolha outra." };
  }
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error && !/same|different from the old/i.test(error.message)) {
    return { ok: false, mensagem: /weak|short|characters/i.test(error.message) ? "Senha fraca: use pelo menos 12 caracteres com letras e números." : "Não foi possível salvar a senha. Tente de novo." };
  }
  if (!(await marcarSenhaDefinida(s.id))) return { ok: false, mensagem: "Não foi possível salvar a senha. Tente de novo." };
  // Recarrega a sessão para o servidor enxergar a marca nova.
  await supabase.auth.refreshSession();
  await supabase.rpc("aceitar_convites");
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
  for (const f of fatores.filter((x) => x.status === "verified" && x.id !== factorId)) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  redirect("/app?duas-etapas=ok");
}

/** Encerra a sessão em todos os aparelhos (útil se perder o celular ou o computador). */
export async function sairDeTodos(): Promise<void> {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/entrar");
}

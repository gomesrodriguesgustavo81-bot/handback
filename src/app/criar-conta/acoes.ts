"use server";

import { createHmac, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { gerarSlug } from "@/lib/caminhos";
import { convidarPorEmail } from "@/lib/acesso";
import { eFrente } from "@/lib/frentes";
import { plural } from "@/lib/nomes";
import { criarClienteAdmin } from "@/lib/supabase/admin";

export type Cadastro = { ok: boolean; mensagem: string; email?: string; nome?: string; jaTemConta?: boolean } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Cria o espaço de quem se cadastrou pela página de vendas. O espaço só
 * passa a ser da pessoa depois que ela confirmar o e-mail (pelo link do
 * convite) e criar a senha. Sem cobrança por enquanto.
 */
export async function criarConta(_a: Cadastro, dados: FormData): Promise<Cadastro> {
  // Campo escondido: só robô preenche.
  if (String(dados.get("site") ?? "")) return { ok: true, mensagem: "", email: "", nome: "" };

  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  const nome = String(dados.get("nome") ?? "").trim().replace(/\s+/g, " ");
  const frente = String(dados.get("frente") ?? "educacao");
  const palavra = String(dados.get("palavra") ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (!EMAIL.test(email)) return { ok: false, mensagem: "Digite um e-mail válido." };
  if (nome.length < 2 || nome.length > 120) return { ok: false, mensagem: "Escreva o nome do seu espaço (de 2 a 120 letras)." };
  if (!eFrente(frente)) return { ok: false, mensagem: "Escolha para que você vai usar." };
  if (!palavra) return { ok: false, mensagem: "Escreva como você chama o seu espaço." };
  if (dados.get("aceito") !== "on") return { ok: false, mensagem: "Para criar, aceite os Termos e a Política de privacidade." };

  const admin = criarClienteAdmin();
  if (!admin) return { ok: false, mensagem: "O cadastro ainda não está ligado. Tente mais tarde." };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "").split(",")[0].trim();
  const ipHash = ip ? createHmac("sha256", process.env.SUPABASE_SECRET_KEY ?? "handback").update(ip).digest("hex").slice(0, 32) : "";
  const slug = `${gerarSlug(nome).slice(0, 48) || "espaco"}-${randomBytes(3).toString("hex")}`;

  const { error } = await admin.rpc("criar_espaco_por_cadastro", {
    p_nome: nome,
    p_slug: slug,
    p_frente: frente,
    p_palavra: palavra,
    p_palavras: plural(palavra),
    p_email: email,
    p_ip_hash: ipHash,
  });
  if (error) {
    if (error.code === "P0001" && error.message) return { ok: false, mensagem: error.message };
    console.error("[cadastro]", error.message);
    return { ok: false, mensagem: "Não foi possível criar agora. Tente de novo." };
  }
  const convite = await convidarPorEmail(email, nome, true);
  if (convite === "erro") return { ok: false, mensagem: "O espaço foi criado, mas o e-mail não saiu. Tente de novo daqui a pouco." };
  return { ok: true, mensagem: "", email, nome, jaTemConta: convite === "ja-tem-conta" };
}

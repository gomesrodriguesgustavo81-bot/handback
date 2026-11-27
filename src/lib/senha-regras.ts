/**
 * Regras de senha do Handback, sem nada que só roda no servidor: a tela usa as
 * mesmas regras para mostrar, ao vivo, o que falta e se a senha é fraca, média ou forte.
 * (O Supabase também confere: tamanho e maiúscula, minúscula, número e símbolo.)
 */
export const TAMANHO_MINIMO = 8;
/** A partir daqui, atendendo a todas as regras, a senha é "forte". */
export const TAMANHO_FORTE = 12;

/** Os mesmos símbolos que o Supabase aceita como "caractere especial". */
const ESPECIAL = /[!@#$%^&*()_+\-=[\]{};':"|<>?,./`~]/;

const COMUNS = ["123456", "senha", "password", "qwerty", "handback", "abc123", "111111", "000000", "brasil"];

export type Requisitos = { tamanho: boolean; maiuscula: boolean; minuscula: boolean; numero: boolean; especial: boolean };

export function requisitosDaSenha(senha: string): Requisitos {
  return {
    tamanho: senha.length >= TAMANHO_MINIMO,
    maiuscula: /\p{Lu}/u.test(senha),
    minuscula: /\p{Ll}/u.test(senha),
    numero: /\d/.test(senha),
    especial: ESPECIAL.test(senha),
  };
}

function muitoRepetitiva(senha: string): boolean {
  return /^(.)\1+$/.test(senha.replace(/\d/g, "")) && /^(.)\1+$/.test(senha.replace(/\D/g, ""));
}

function contemEmail(senha: string, email: string): boolean {
  const usuario = email.split("@")[0]?.toLowerCase() ?? "";
  return usuario.length >= 4 && senha.toLowerCase().includes(usuario);
}

function muitoComum(senha: string): boolean {
  const minus = senha.toLowerCase();
  return COMUNS.some((c) => minus.includes(c) && minus.replace(c, "").replace(/\d/g, "").length < 4);
}

/** Devolve o motivo de a senha ser fraca, ou null se estiver boa. */
export function problemaNaSenha(senha: string, email: string): string | null {
  const r = requisitosDaSenha(senha);
  if (!r.tamanho) return `A senha precisa ter pelo menos ${TAMANHO_MINIMO} caracteres.`;
  if (senha.length > 128) return "A senha pode ter no máximo 128 caracteres.";
  if (!r.maiuscula) return "Use pelo menos uma letra maiúscula na senha.";
  if (!r.minuscula) return "Use pelo menos uma letra minúscula na senha.";
  if (!r.numero) return "Use pelo menos um número na senha.";
  if (!r.especial) return "Use pelo menos um caractere especial na senha (como ! @ # $ %).";
  if (muitoRepetitiva(senha)) return "A senha é muito repetitiva.";
  if (contemEmail(senha, email)) return "A senha não pode conter o seu e-mail.";
  if (muitoComum(senha)) return "Essa senha é muito comum. Escolha outra.";
  return null;
}

export type Forca = "vazia" | "fraca" | "media" | "forte";

/**
 * Fraca: falta alguma regra, é repetitiva, comum ou tem o seu e-mail.
 * Média: cumpre todas as regras, com 8 a 11 caracteres.
 * Forte: cumpre todas as regras e tem 12 caracteres ou mais.
 */
export function forcaDaSenha(senha: string, email = ""): Forca {
  if (!senha) return "vazia";
  if (problemaNaSenha(senha, email)) return "fraca";
  return senha.length >= TAMANHO_FORTE ? "forte" : "media";
}

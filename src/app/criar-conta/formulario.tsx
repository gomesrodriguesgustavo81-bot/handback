"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Aviso, Botao, Campo } from "@/components/ui";
import { criarConta, type Cadastro } from "./acoes";

const USOS = [
  { id: "escola", nome: "Escola / faculdade", frente: "educacao", palavra: "Escola", exemplo: "Ex.: Colégio Horizonte" },
  { id: "time", nome: "Empresa / time", frente: "empresa", palavra: "Time", exemplo: "Ex.: Squad Mobile" },
  { id: "escritorio", nome: "Escritório", frente: "escritorio", palavra: "Escritório", exemplo: "Ex.: Souza & Lima" },
  { id: "consultoria", nome: "Consultoria / hub", frente: "consultoria", palavra: "Hub", exemplo: "Ex.: Hub de Inovação" },
  { id: "outro", nome: "Outro", frente: "empresa", palavra: "", exemplo: "Ex.: Mentoria Alfa" },
] as const;

/** Cadastro: e-mail, para que vai usar e o nome do espaço. Depois, confirmar o e-mail. */
export function FormCadastro() {
  const [estado, enviar, enviando] = useActionState<Cadastro, FormData>(criarConta, null);
  const [uso, setUso] = useState<(typeof USOS)[number]["id"]>("escola");
  const [outra, setOutra] = useState("");
  const u = USOS.find((x) => x.id === uso)!;
  const palavra = uso === "outro" ? outra : u.palavra;
  const min = (palavra || "espaço").toLowerCase();
  const de = /a$|ção$|dade$/i.test(min) ? "da" : "do";

  if (estado?.ok) {
    return (
      <section className="entra flex flex-col items-center gap-3 rounded-3xl border border-borda bg-cartao p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-acento text-sobre-acento">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </span>
        <h1 className="text-2xl font-extrabold">{estado.jaTemConta ? "Pronto!" : "Confira seu e-mail"}</h1>
        {estado.jaTemConta ? (
          <p className="text-suave">
            <strong className="text-texto">{estado.email}</strong> já tem conta no Handback. Entre com ela: o espaço “{estado.nome}” já aparece lá.
          </p>
        ) : (
          <p className="text-suave">
            Mandamos um link para <strong className="text-texto">{estado.email}</strong>. Toque nele para criar sua senha. Depois você ativa o código do
            celular e o espaço “{estado.nome}” fica pronto.
          </p>
        )}
        {estado.jaTemConta ? (
          <Link href="/entrar" className="inline-flex min-h-11 items-center rounded-full bg-marca-forte px-5 font-medium text-white">
            Entrar
          </Link>
        ) : (
          <p className="text-xs text-suave">Não chegou? Olhe a caixa de spam. O link vale por 24 horas.</p>
        )}
      </section>
    );
  }

  return (
    <form action={enviar} className="entra flex flex-col gap-4 rounded-3xl border border-borda bg-cartao p-6">
      <div>
        <h1 className="text-2xl font-extrabold">Criar minha conta</h1>
        <p className="text-sm text-suave">Grátis por enquanto. Leva 1 minuto.</p>
      </div>
      <Campo rotulo="Seu e-mail" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="voce@exemplo.com" />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Para que você vai usar?</legend>
        <div className="flex flex-wrap gap-1.5">
          {USOS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={uso === x.id}
              onClick={() => setUso(x.id)}
              className={`min-h-10 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                uso === x.id ? "bg-acento text-sobre-acento" : "border border-borda bg-cartao text-suave hover:text-texto"
              }`}
            >
              {x.nome}
            </button>
          ))}
        </div>
        <input type="hidden" name="frente" value={u.frente} />
      </fieldset>
      {uso === "outro" ? (
        <Campo rotulo="Como você chama o seu espaço?" name="palavra" required maxLength={40} value={outra} onChange={(e) => setOutra(e.target.value)} placeholder="Ex.: Mentoria, Clínica, Igreja" />
      ) : (
        <input type="hidden" name="palavra" value={palavra} />
      )}
      <Campo rotulo={`Nome ${de} ${min}`} name="nome" required maxLength={120} placeholder={u.exemplo} />
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Site <input name="site" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex items-start gap-2.5 text-sm">
        <input type="checkbox" name="aceito" required className="mt-0.5 size-5 shrink-0 accent-[var(--marca)]" />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" className="font-medium text-marca-forte underline">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" className="font-medium text-marca-forte underline">
            Política de privacidade
          </Link>
          .
        </span>
      </label>
      {estado && !estado.ok ? <Aviso tipo="erro">{estado.mensagem}</Aviso> : null}
      <Botao type="submit" disabled={enviando}>
        {enviando ? "Criando…" : "Criar e confirmar e-mail"}
      </Botao>
      <p className="text-center text-sm text-suave">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-marca-forte underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}

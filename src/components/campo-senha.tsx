"use client";

import { useEffect, useId, useState } from "react";
import { faixaDeSenhasVazadas } from "@/app/conta/acoes";
import { forcaDaSenha, requisitosDaSenha, TAMANHO_MINIMO, type Forca } from "@/lib/senha-regras";

const ROTULO: Record<Exclude<Forca, "vazia">, { texto: string; classe: string; barras: number }> = {
  fraca: { texto: "Fraca", classe: "bg-ruim", barras: 1 },
  media: { texto: "Média", classe: "bg-reg", barras: 2 },
  forte: { texto: "Forte", classe: "bg-ok", barras: 3 },
};

const CARACTERES = {
  maiusculas: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  minusculas: "abcdefghijkmnopqrstuvwxyz",
  numeros: "23456789",
  especiais: "!@#$%&*?+-=",
};

/** Sorteia uma senha forte (16 caracteres, com os 4 tipos), no próprio aparelho. */
function gerarSenha(): string {
  const todos = Object.values(CARACTERES).join("");
  const sorteio = (conjunto: string) => {
    const n = new Uint32Array(1);
    // Sem viés: descarta valores que sobrariam na divisão.
    const limite = Math.floor(0x100000000 / conjunto.length) * conjunto.length;
    do crypto.getRandomValues(n);
    while (n[0] >= limite);
    return conjunto[n[0] % conjunto.length];
  };
  const letras = [sorteio(CARACTERES.maiusculas), sorteio(CARACTERES.minusculas), sorteio(CARACTERES.numeros), sorteio(CARACTERES.especiais)];
  while (letras.length < 16) letras.push(sorteio(todos));
  // Embaralha (Fisher-Yates) para os 4 tipos não ficarem sempre no começo.
  for (let i = letras.length - 1; i > 0; i--) {
    const n = new Uint32Array(1);
    const limite = Math.floor(0x100000000 / (i + 1)) * (i + 1);
    do crypto.getRandomValues(n);
    while (n[0] >= limite);
    const j = n[0] % (i + 1);
    [letras[i], letras[j]] = [letras[j], letras[i]];
  }
  return letras.join("");
}

async function sha1(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

type Vazamento = "nao-verificada" | "verificando" | "vazada" | "limpa";

/**
 * Campo de senha com o que falta, força (fraca, média, forte) e aviso de vazamento ao vivo.
 * A consulta de vazamento manda ao servidor só os 5 primeiros caracteres do resumo (SHA-1):
 * a senha em si não sai do aparelho por esse caminho.
 */
export function CampoSenha({
  valor,
  aoMudar,
  email,
  aoGerar,
  name = "senha",
  rotulo = "Nova senha",
}: {
  valor: string;
  aoMudar: (v: string) => void;
  email: string;
  /** Chamado quando a pessoa pede uma senha sugerida (para o campo "repita" acompanhar). */
  aoGerar?: (v: string) => void;
  name?: string;
  rotulo?: string;
}) {
  const id = useId();
  const [mostrar, setMostrar] = useState(false);
  const [vazamento, setVazamento] = useState<Vazamento>("nao-verificada");
  const req = requisitosDaSenha(valor);
  const forca = forcaDaSenha(valor, email);
  const cumpre = req.tamanho && req.maiuscula && req.minuscula && req.numero && req.especial;

  // Só consulta vazamento quando a senha já cumpre as regras (evita consultar a cada letra).
  useEffect(() => {
    if (!cumpre || !globalThis.crypto?.subtle) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVazamento("nao-verificada");
      return;
    }
    let cancelado = false;
    setVazamento("verificando");
    const espera = setTimeout(async () => {
      try {
        const resumo = await sha1(valor);
        const faixa = await faixaDeSenhasVazadas(resumo.slice(0, 5));
        if (cancelado) return;
        const resto = resumo.slice(5);
        const achou = faixa.split("\n").some((l) => {
          const [sufixo, vezes] = l.trim().split(":");
          return sufixo === resto && Number(vezes) > 0;
        });
        setVazamento(achou ? "vazada" : "limpa");
      } catch {
        if (!cancelado) setVazamento("nao-verificada");
      }
    }, 600);
    return () => {
      cancelado = true;
      clearTimeout(espera);
    };
  }, [valor, cumpre]);

  const vazada = vazamento === "vazada";
  const mostrada: Exclude<Forca, "vazia"> | null = valor ? (vazada ? "fraca" : (forca as Exclude<Forca, "vazia">)) : null;
  const item = (ok: boolean, texto: string) => (
    <li key={texto} className={ok ? "text-ok" : "text-suave"}>
      <span aria-hidden>{ok ? "✓" : "○"}</span> {texto}
      <span className="sr-only">{ok ? " (ok)" : " (falta)"}</span>
    </li>
  );

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          name={name}
          type={mostrar ? "text" : "password"}
          autoComplete="new-password"
          required
          minLength={TAMANHO_MINIMO}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          aria-describedby={`${id}-regras`}
          className="min-h-11 w-full min-w-0 rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
        />
        <button
          type="button"
          aria-pressed={mostrar}
          onClick={() => setMostrar((m) => !m)}
          className="toque min-h-11 shrink-0 rounded-xl border border-borda bg-cartao px-3 text-sm font-medium text-texto hover:bg-fundo"
        >
          {mostrar ? "Ocultar" : "Mostrar"}
        </button>
      </div>

      <div id={`${id}-regras`} className="flex flex-col gap-2">
        <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm">
          <span aria-hidden className="grid h-1.5 w-24 grid-cols-3 gap-1">
            {[1, 2, 3].map((n) => (
              <span key={n} className={`rounded-full ${mostrada && n <= ROTULO[mostrada].barras ? ROTULO[mostrada].classe : "bg-borda"}`} />
            ))}
          </span>
          <span className="font-semibold">{mostrada ? `Senha ${ROTULO[mostrada].texto.toLowerCase()}` : "Digite a senha"}</span>
          {vazamento === "verificando" ? <span className="text-xs text-suave">verificando vazamentos…</span> : null}
        </div>
        <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
          {item(req.tamanho, `${TAMANHO_MINIMO} ou mais caracteres`)}
          {item(req.maiuscula, "Uma letra maiúscula")}
          {item(req.minuscula, "Uma letra minúscula")}
          {item(req.numero, "Um número")}
          {item(req.especial, "Um caractere especial (! @ # $ %)")}
        </ul>
        {vazada ? (
          <p role="alert" className="rounded-xl bg-ruim-fundo p-2.5 text-xs font-medium text-ruim">
            Essa senha já apareceu em vazamentos de dados na internet. Escolha outra.
          </p>
        ) : vazamento === "limpa" ? (
          <p className="text-xs text-ok">✓ Não apareceu em vazamentos conhecidos.</p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            const nova = gerarSenha();
            aoMudar(nova);
            aoGerar?.(nova);
            setMostrar(true);
          }}
          className="self-start text-xs font-semibold text-marca-forte hover:underline"
        >
          Sugerir uma senha forte
        </button>
      </div>
    </div>
  );
}

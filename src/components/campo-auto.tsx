"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { salvarConfiguracao } from "@/app/app/[slug]/configuracoes/acoes";

type Estado = "parado" | "salvando" | "salvo" | "erro";

/** Mostra "Salvando…", "Salvo ✓" (some sozinho) ou o erro, ao lado do campo. */
export function SinalSalvo({ estado, erro }: { estado: Estado; erro: string }) {
  if (estado === "parado") return null;
  if (estado === "erro") return <span role="alert" className="text-xs font-medium text-erro">{erro}</span>;
  return (
    <span role="status" className={`salvo-pilula ${estado === "salvo" ? "salvo-some" : ""}`}>
      {estado === "salvando" ? "Salvando…" : "Salvo ✓"}
    </span>
  );
}

/** Lógica comum: salva um campo e mostra o sinal. */
export function useSalvar(
  slug: string,
  campo: string,
  inicial: string,
  acao: (valor: string) => Promise<{ ok: boolean; mensagem: string }> = (valor) => salvarConfiguracao(slug, campo, valor),
) {
  const router = useRouter();
  const ultimo = useRef(inicial);
  const [estado, setEstado] = useState<Estado>("parado");
  const [erro, setErro] = useState("");
  const [, iniciar] = useTransition();
  const salvar = (valor: string) => {
    if (valor.trim() === ultimo.current.trim()) return;
    setEstado("salvando");
    iniciar(async () => {
      const r = await acao(valor);
      if (r.ok) {
        ultimo.current = valor;
        setEstado("salvo");
        router.refresh();
      } else {
        setErro(r.mensagem);
        setEstado("erro");
      }
    });
  };
  return { salvar, estado, erro };
}

const CAIXA = "w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto placeholder:text-suave";

/**
 * Campo das Configurações que salva sozinho: texto e área salvam quando a
 * pessoa sai do campo; escolha salva na hora.
 */
export function CampoAuto({
  slug,
  campo,
  rotulo,
  valor,
  tipo = "texto",
  opcoes,
  dica,
  linhas = 3,
  maximo,
  aoMudar,
}: {
  slug: string;
  campo: string;
  rotulo: string;
  valor: string;
  tipo?: "texto" | "area" | "escolha";
  opcoes?: { valor: string; nome: string }[];
  dica?: string;
  linhas?: number;
  maximo?: number;
  aoMudar?: (valor: string) => void;
}) {
  const { salvar, estado, erro } = useSalvar(slug, campo, valor);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{rotulo}</span>
        <SinalSalvo estado={estado} erro={erro} />
      </span>
      {tipo === "escolha" ? (
        <select
          defaultValue={valor}
          onChange={(e) => {
            aoMudar?.(e.target.value);
            salvar(e.target.value);
          }}
          className={`min-h-11 ${CAIXA}`}
        >
          {(opcoes ?? []).map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.nome}
            </option>
          ))}
        </select>
      ) : tipo === "area" ? (
        <textarea
          defaultValue={valor}
          rows={linhas}
          maxLength={maximo}
          onChange={(e) => aoMudar?.(e.target.value)}
          onBlur={(e) => salvar(e.target.value)}
          className={`py-2 leading-relaxed ${CAIXA}`}
        />
      ) : (
        <input
          defaultValue={valor}
          maxLength={maximo}
          onChange={(e) => aoMudar?.(e.target.value)}
          onBlur={(e) => salvar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className={`min-h-11 ${CAIXA}`}
        />
      )}
      {dica ? <span className="text-xs text-suave">{dica}</span> : null}
    </label>
  );
}

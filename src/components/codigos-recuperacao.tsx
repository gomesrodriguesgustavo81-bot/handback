"use client";

import { useState } from "react";
import { gerarCodigosDeRecuperacao } from "@/app/conta/acoes";
import { Aviso, Botao } from "./ui";
import { useConfirmar } from "./confirmar";

/**
 * Códigos de recuperação da verificação em duas etapas: aparecem inteiros uma única vez,
 * para a pessoa guardar. Gerar de novo apaga os anteriores (por isso pergunta antes).
 */
export function CodigosDeRecuperacao({ restantes }: { restantes: number }) {
  const { pedir, janela } = useConfirmar();
  const [codigos, setCodigos] = useState<string[] | null>(null);
  const [erro, setErro] = useState("");
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function gerar() {
    const ok = await pedir({
      titulo: restantes > 0 ? "Gerar códigos novos?" : "Gerar os códigos de recuperação?",
      texto: restantes > 0 ? "Os códigos de agora deixam de valer. Os novos aparecem uma única vez: guarde num lugar seguro." : "Eles aparecem uma única vez. Guarde num lugar seguro, longe do celular.",
      sim: "Sim, gerar",
    });
    if (!ok) return;
    setGerando(true);
    setErro("");
    const r = await gerarCodigosDeRecuperacao();
    setGerando(false);
    if (r.ok) setCodigos(r.codigos);
    else setErro(r.mensagem);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-suave">
        Se perder o celular, um destes códigos desliga a verificação em duas etapas para você cadastrar o celular novo. Cada código vale uma vez.
      </p>
      {codigos ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-borda bg-fundo p-3">
          <p className="text-sm font-semibold">Guarde agora. Esta lista não aparece de novo.</p>
          <ul aria-label="Códigos de recuperação" className="grid grid-cols-2 gap-1.5 font-mono text-[15px] tracking-wide">
            {codigos.map((c) => (
              <li key={c} className="rounded-lg bg-cartao px-2 py-1.5 text-center">
                {c}
              </li>
            ))}
          </ul>
          <Botao
            type="button"
            variante="secundario"
            className="self-start"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(codigos.join("\n"));
                setCopiado(true);
              } catch {
                setCopiado(false);
              }
            }}
          >
            {copiado ? "Copiados ✓" : "Copiar todos"}
          </Botao>
        </div>
      ) : (
        <p className="text-sm">
          {restantes > 0 ? (
            <>
              Você tem <strong>{restantes}</strong> {restantes === 1 ? "código" : "códigos"} guardado{restantes === 1 ? "" : "s"}.
            </>
          ) : (
            <strong className="text-alerta">Você ainda não gerou os códigos de recuperação.</strong>
          )}
        </p>
      )}
      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      <Botao type="button" variante="secundario" className="self-start" disabled={gerando} onClick={gerar}>
        {gerando ? "Gerando…" : restantes > 0 || codigos ? "Gerar códigos novos" : "Gerar códigos"}
      </Botao>
      {janela}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Aviso, LinkBotao } from "@/components/ui";
import { aceitarConvitesAgora } from "./acoes";

export function Continuar({ config, voltar }: { config: { url: string; chave: string }; voltar: string }) {
  const [erro, setErro] = useState(false);
  useEffect(() => {
    const dados = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    // Tira os dados de acesso da barra de endereço (e do histórico) na hora.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const acesso = dados.get("access_token");
    const renovacao = dados.get("refresh_token");
    const tipo = dados.get("type");
    const destino = tipo === "invite" || tipo === "recovery" || tipo === "signup" ? "/definir-senha" : voltar;
    async function terminar() {
      if (!acesso || !renovacao || dados.get("error")) throw new Error("link inválido");
      const supabase = createBrowserClient(config.url, config.chave);
      const { error } = await supabase.auth.setSession({ access_token: acesso, refresh_token: renovacao });
      if (error) throw error;
      await aceitarConvitesAgora();
      window.location.replace(destino);
    }
    terminar().catch(() => setErro(true));
  }, [config.url, config.chave, voltar]);

  if (erro) {
    return (
      <div className="flex flex-col gap-3">
        <Aviso tipo="erro">O link expirou ou já foi usado. Peça um novo em “Esqueci minha senha” ou ao administrador da sua empresa.</Aviso>
        <LinkBotao href="/entrar">Ir para entrar</LinkBotao>
      </div>
    );
  }
  return <p className="text-sm text-suave">Só um instante…</p>;
}

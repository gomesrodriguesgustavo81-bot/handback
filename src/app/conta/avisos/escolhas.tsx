"use client";

import { useEffect, useState } from "react";
import { SinalSalvo, useSalvar } from "@/components/campo-auto";
import { salvarPreferencia } from "./acoes";

function Caixa({ campo, nome, detalhe, inicial, travado }: { campo: string; nome: string; detalhe?: string; inicial: boolean; travado?: boolean }) {
  const [marcado, setMarcado] = useState(inicial);
  const { salvar, estado, erro } = useSalvar("", campo, inicial ? "sim" : "nao", (v) => salvarPreferencia(campo, v));
  return (
    <label className="flex min-h-13 cursor-pointer items-center justify-between gap-3 border-t border-borda py-2 first-of-type:border-t-0">
      <span className="flex flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
          {nome}
          <SinalSalvo estado={estado} erro={erro} />
        </span>
        {detalhe ? <span className="text-xs text-suave">{detalhe}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={marcado}
        disabled={travado}
        onChange={(e) => {
          setMarcado(e.target.checked);
          salvar(e.target.checked ? "sim" : "nao");
        }}
        className="size-6 shrink-0 accent-[var(--marca)]"
      />
    </label>
  );
}

function base64ParaBytes(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

type Situacao = "carregando" | "sem-suporte" | "iphone" | "bloqueado" | "desligado" | "ligado";

/** Ativa as notificações neste aparelho (pede a permissão do navegador). */
function Celular() {
  const [situacao, setSituacao] = useState<Situacao>("carregando");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    (async () => {
      const iphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const instalado = window.matchMedia("(display-mode: standalone)").matches;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setSituacao(iphone && !instalado ? "iphone" : "sem-suporte");
        return;
      }
      if (Notification.permission === "denied") return setSituacao("bloqueado");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const inscricao = await reg?.pushManager.getSubscription();
      setSituacao(inscricao ? "ligado" : "desligado");
    })().catch(() => setSituacao("sem-suporte"));
  }, []);

  async function ativar() {
    setErro("");
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setSituacao(permissao === "denied" ? "bloqueado" : "desligado");
        return;
      }
      const r = await fetch("/api/push");
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? "Não foi possível ativar.");
      const { chave } = await r.json();
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ParaBytes(chave) });
      const salvar = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(inscricao.toJSON()) });
      if (!salvar.ok) throw new Error("Não foi possível guardar este aparelho.");
      setSituacao("ligado");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ativar.");
    } finally {
      setOcupado(false);
    }
  }

  async function desativar() {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const inscricao = await reg?.pushManager.getSubscription();
      if (inscricao) {
        await fetch(`/api/push?endpoint=${encodeURIComponent(inscricao.endpoint)}`, { method: "DELETE" });
        await inscricao.unsubscribe();
      }
      setSituacao("desligado");
    } finally {
      setOcupado(false);
    }
  }

  const botao = "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold disabled:opacity-60";
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-marca-clara p-3 text-sm">
      {situacao === "carregando" ? <span className="text-suave">Verificando este aparelho…</span> : null}
      {situacao === "iphone" ? (
        <span>
          No iPhone, primeiro toque em <strong>Compartilhar › Adicionar à Tela de Início</strong> e abra o Handback por lá. Depois volte aqui para ativar.
        </span>
      ) : null}
      {situacao === "sem-suporte" ? <span>Este navegador não recebe notificações. Tente pelo Chrome, Edge ou Safari atualizado.</span> : null}
      {situacao === "bloqueado" ? (
        <span>As notificações estão bloqueadas para o Handback neste navegador. Libere nas configurações do site (o cadeado ao lado do endereço) e volte aqui.</span>
      ) : null}
      {situacao === "desligado" ? (
        <>
          <span>Para receber neste aparelho, toque no botão e depois em <strong>Permitir</strong>.</span>
          <button type="button" disabled={ocupado} onClick={ativar} className={`${botao} self-start bg-marca text-sobre-marca hover:bg-marca-forte`}>
            {ocupado ? "Ativando…" : "Ativar neste aparelho"}
          </button>
        </>
      ) : null}
      {situacao === "ligado" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-acento px-2.5 py-1 text-xs font-bold text-sobre-acento">Ativado neste aparelho</span>
          <button type="button" disabled={ocupado} onClick={desativar} className={`${botao} border border-borda bg-cartao text-texto hover:bg-fundo`}>
            Desativar neste aparelho
          </button>
        </div>
      ) : null}
      {erro ? <span role="alert" className="text-erro">{erro}</span> : null}
    </div>
  );
}

export function EscolhasAvisos({ prefs, temGmail }: { prefs: { resumo_email: boolean; celular: boolean; tipos: string[] }; temGmail: boolean }) {
  return (
    <>
      <section aria-label="Como quero saber" className="flex flex-col rounded-2xl border border-borda bg-cartao p-4">
        <h2 className="mb-1 font-semibold">Como quero saber</h2>
        <Caixa campo="app" nome="No sininho do app" detalhe="Sempre ligado" inicial travado />
        <Caixa
          campo="resumo_email"
          nome="Resumo do dia por e-mail"
          detalhe={temGmail ? "Um e-mail às 9h, só se tiver novidade. Sai do seu Gmail para você mesmo." : "Às 9h, só se tiver novidade. Precisa do seu Gmail conectado (Configurações › E-mail)."}
          inicial={prefs.resumo_email}
        />
        <Caixa campo="celular" nome="Notificação no celular" detalhe="Na hora em que acontece" inicial={prefs.celular} />
        <div className="mt-2">
          <Celular />
        </div>
      </section>
      <section aria-label="Do que quero saber" className="flex flex-col rounded-2xl border border-borda bg-cartao p-4">
        <h2 className="mb-1 font-semibold">Do que quero saber</h2>
        <Caixa campo="tipo_entrega" nome="Entrega nova chegou" inicial={prefs.tipos.includes("entrega")} />
        <Caixa campo="tipo_ia" nome="Análise da IA pronta para revisar" inicial={prefs.tipos.includes("ia")} />
        <Caixa campo="tipo_prazo" nome="Prazo chegando e quem falta entregar" inicial={prefs.tipos.includes("prazo")} />
        <Caixa campo="tipo_atraso" nome="Entrega com atraso" inicial={prefs.tipos.includes("atraso")} />
        <Caixa campo="tipo_enviada" nome="Devolutiva enviada por um colega" inicial={prefs.tipos.includes("enviada")} />
      </section>
    </>
  );
}

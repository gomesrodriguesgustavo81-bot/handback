"use client";
import { useConfirmar } from "@/components/confirmar";

import { startTransition, useActionState, useState, useTransition } from "react";
import type { Resultado } from "@/components/form-acao";
import { Aviso, Botao, Campo } from "@/components/ui";
import { conectarMoodle, examinarMoodle, type Exame } from "./acoes";

type Pronto = Extract<Exame, { ok: true }>;

function Cadeado() {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-marca-clara px-3 py-2.5 text-sm text-marca-forte">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-0.5 shrink-0">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <span>
        A senha ou a chave é usada só para o Moodle liberar o acesso. A senha não fica guardada; a chave fica cifrada. Você pode cortar o acesso
        quando quiser.
      </span>
    </p>
  );
}

/** Passo a passo ilustrado para pegar a chave de acesso no Moodle. */
function GuiaChave({ host }: { host: string }) {
  const moldura = "rounded-xl border border-borda bg-fundo p-3 text-[13px]";
  return (
    <ol aria-label="Como pegar a chave de acesso" className="flex flex-col gap-3">
      <li className="flex flex-col gap-2">
        <span className="font-semibold">1. No celular, entre uma vez pelo aplicativo oficial “Moodle”</span>
        <div className={`${moldura} mx-auto w-full max-w-60`} aria-hidden>
          <div className="rounded-lg bg-cartao p-2.5 shadow-sm">
            <p className="text-center text-xs font-bold text-alerta">Moodle</p>
            <p className="mt-2 text-[11px] text-suave">Endereço do site</p>
            <p className="truncate rounded-md border border-borda px-2 py-1 text-xs">{host}</p>
            <p className="mt-2 rounded-md bg-alerta py-1 text-center text-xs font-semibold text-white">Conectar</p>
          </div>
        </div>
        <span className="text-xs text-suave">Coloque o endereço acima e entre com o login da instituição, como você já faz. Isso cria a chave.</span>
      </li>
      <li className="flex flex-col gap-2">
        <span className="font-semibold">2. No navegador, abra o Moodle › seu nome › Preferências</span>
        <div className={moldura} aria-hidden>
          <div className="ml-auto w-44 rounded-lg border border-borda bg-cartao py-1 text-xs shadow-sm">
            <p className="px-3 py-1 text-suave">Perfil</p>
            <p className="px-3 py-1 text-suave">Notas</p>
            <p className="bg-marca-clara px-3 py-1 font-semibold text-marca-forte">Preferências ←</p>
            <p className="px-3 py-1 text-suave">Sair</p>
          </div>
        </div>
      </li>
      <li className="flex flex-col gap-2">
        <span className="font-semibold">3. Toque em “Chaves de segurança” e copie a chave do serviço móvel</span>
        <div className={moldura} aria-hidden>
          <div className="overflow-hidden rounded-lg border border-borda bg-cartao text-xs">
            <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-borda bg-marca-clara px-3 py-2">
              <span className="font-semibold text-marca-forte">Moodle mobile web service</span>
              <span className="font-mono text-marca-forte">a1b2…c3d4</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-suave line-through">
              <span>Chave RSS</span>
              <span className="font-mono">e5f6…7a8b</span>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-suave">Use a da linha destacada. A chave RSS não serve.</p>
        </div>
      </li>
      <li className="text-xs text-suave">
        Ilustrações: no seu Moodle a tela pode estar um pouco diferente. Se não achar a linha, peça a chave ao suporte da instituição.
      </li>
    </ol>
  );
}

export function FormConectarMoodle({ slug, enderecoInicial, expirada }: { slug: string; enderecoInicial: string; expirada: string }) {
  const [endereco, setEndereco] = useState(enderecoInicial);
  const [exame, setExame] = useState<Pronto | null>(null);
  const [erroExame, setErroExame] = useState("");
  const [olhando, iniciarExame] = useTransition();
  const [modo, setModo] = useState<"senha" | "chave">("senha");
  const [estado, conectar, conectando] = useActionState<Resultado, FormData>(conectarMoodle.bind(null, slug), null);
  const { pedir, janela } = useConfirmar();

  function examinar() {
    iniciarExame(async () => {
      setErroExame("");
      const r = await examinarMoodle(slug, endereco);
      if (!r.ok) {
        setErroExame(r.mensagem);
        return;
      }
      setExame(r);
      setModo(r.tipo === "instituicao" ? "chave" : "senha");
    });
  }

  if (!exame) {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          examinar();
        }}
      >
        {expirada ? <Aviso tipo="alerta">{expirada}</Aviso> : null}
        <p className="text-sm">Use o mesmo login que você usa no Moodle da sua instituição. O Handback traz as disciplinas, os alunos e as entregas de lá.</p>
        <Campo
          rotulo="Endereço do Moodle"
          name="endereco"
          required
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="ava.suafaculdade.edu.br"
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          dica="É o endereço do site, o que aparece no navegador quando você abre o Moodle (não é o seu e-mail)."
        />
        {erroExame ? <Aviso tipo="erro">{erroExame}</Aviso> : null}
        <Botao type="submit" disabled={olhando}>
          {olhando ? "Abrindo o Moodle…" : "Continuar"}
        </Botao>
      </form>
    );
  }

  const host = exame.site.replace(/^https?:\/\//, "");
  const outroLogin = exame.provedores.length ? exame.provedores.join(" ou ") : "login da instituição (Senha Única, Google, Microsoft)";
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        if (!(await pedir({ titulo: `Conectar ao Moodle ${host}?`, texto: "O Handback guarda só a chave de acesso, cifrada. Você pode desconectar quando quiser.", sim: "Sim, conectar" }))) return;
        startTransition(() => conectar(dados));
      }}
    >
      {janela}
      <input type="hidden" name="endereco" value={exame.site} />
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-borda px-3 py-2 text-sm">
        <span className="min-w-0 [overflow-wrap:anywhere]">
          <strong>{exame.nome || host}</strong>
          {exame.nome ? <span className="text-suave"> · {host}</span> : null}
        </span>
        <button type="button" onClick={() => setExame(null)} className="min-h-11 text-sm font-medium text-marca-forte underline">
          Trocar
        </button>
      </div>

      {exame.tipo === "misto" || exame.tipo === "desconhecido" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Como você entra nesse Moodle?</legend>
          {(
            [
              ["senha", "Com usuário e senha do próprio Moodle"],
              ["chave", `Com ${outroLogin}`],
            ] as const
          ).map(([valor, texto]) => (
            <label
              key={valor}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-borda px-3 py-2 has-[:checked]:border-2 has-[:checked]:border-marca"
            >
              <input type="radio" name="modo" checked={modo === valor} onChange={() => setModo(valor)} className="size-5 shrink-0 accent-[var(--marca)]" />
              <span className="text-sm">{texto}</span>
            </label>
          ))}
        </fieldset>
      ) : exame.tipo === "instituicao" ? (
        <Aviso>
          Esse Moodle usa o login da instituição{exame.provedores.length ? ` (${outroLogin})` : ""}. Para ligar, o Handback precisa de uma chave de acesso: são 3
          passos, uma vez só.
        </Aviso>
      ) : null}

      {modo === "senha" ? (
        <>
          <Campo rotulo="Usuário do Moodle" name="usuario" required autoComplete="off" autoCapitalize="none" autoCorrect="off" />
          <Campo rotulo="Senha do Moodle" name="senha" type="password" required autoComplete="off" />
          {exame.tipo === "senha" ? (
            <button type="button" onClick={() => setModo("chave")} className="self-start text-sm font-medium text-marca-forte underline">
              Entro por outro login (Senha Única, Google, Microsoft)
            </button>
          ) : null}
        </>
      ) : (
        <>
          <GuiaChave host={host} />
          <Campo rotulo="Chave de acesso" name="chave" required autoComplete="off" autoCapitalize="none" autoCorrect="off" placeholder="Cole aqui a chave copiada" />
          {exame.tipo === "instituicao" ? (
            <button type="button" onClick={() => setModo("senha")} className="self-start text-sm font-medium text-marca-forte underline">
              Tenho usuário e senha do Moodle
            </button>
          ) : null}
        </>
      )}

      <Cadeado />
      {estado && !estado.ok ? <Aviso tipo="erro">{estado.mensagem}</Aviso> : null}
      <Botao type="submit" disabled={conectando}>
        {conectando ? "Conectando…" : "Conectar ao Moodle"}
      </Botao>
    </form>
  );
}

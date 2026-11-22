"use client";

import { useActionState, useEffect, useState, useTransition, startTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { analisarComIA, aprovarProntas, reabrirDevolutiva, revisarDevolutiva } from "@/app/app/[slug]/entregas/acoes";
import { CONCEITOS_REVISAO, ESTILO_CONCEITO } from "./conceito";
import { BotaoEnviar } from "./envio";
import type { Resultado } from "./form-acao";
import { Aviso, Botao, LinkBotao } from "./ui";

/** Cronômetro simples enquanto a IA trabalha. */
function useSegundos(ativo: boolean) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const inicio = Date.now();
    const t = setInterval(() => setS(Math.round((Date.now() - inicio) / 1000)), 1000);
    return () => {
      clearInterval(t);
      setS(0);
    };
  }, [ativo]);
  return s;
}

export function BotaoAnalisar({
  slug,
  entregaId,
  texto = "Analisar com IA",
  variante = "primario",
}: {
  slug: string;
  entregaId: string;
  texto?: string;
  variante?: "primario" | "secundario";
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const segundos = useSegundos(pendente);
  return (
    <div className="flex flex-col gap-2">
      <Botao
        type="button"
        variante={variante}
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setMsg(null);
            const r = await analisarComIA(slug, entregaId);
            setMsg(r);
            router.refresh();
          })
        }
      >
        {pendente ? `Analisando… ${segundos}s` : texto}
      </Botao>
      {pendente ? <p className="text-xs text-suave">A IA lê os arquivos e escreve a análise. Costuma levar de 20 segundos a 2 minutos.</p> : null}
      {msg && !msg.ok ? <Aviso tipo="erro">{msg.mensagem}</Aviso> : null}
    </div>
  );
}

/** Analisa várias entregas, uma de cada vez, mostrando o andamento. */
export function AnalisarVarias({ slug, entregas, rotulo }: { slug: string; entregas: { id: string; nome: string }[]; rotulo: string }) {
  const router = useRouter();
  const [andando, setAndando] = useState(false);
  const [feitas, setFeitas] = useState(0);
  const [erros, setErros] = useState<string[]>([]);
  if (!entregas.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <Botao
        type="button"
        variante="secundario"
        disabled={andando}
        onClick={async () => {
          setAndando(true);
          setErros([]);
          setFeitas(0);
          for (const e of entregas) {
            const r = await analisarComIA(slug, e.id);
            if (!r.ok) setErros((x) => [...x, `${e.nome}: ${r.mensagem}`]);
            setFeitas((n) => n + 1);
            router.refresh();
          }
          setAndando(false);
        }}
      >
        {andando ? `Analisando ${Math.min(feitas + 1, entregas.length)} de ${entregas.length}…` : rotulo}
      </Botao>
      {erros.length ? (
        <Aviso tipo="erro">
          <ul className="list-disc pl-4">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Aviso>
      ) : null}
    </div>
  );
}

/** Aprova de uma vez as devolutivas prontas do painel. */
export function AprovarProntas({ slug, etapaId, quantas }: { slug: string; etapaId: string; quantas: number }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; mensagem: string } | null>(null);
  if (!quantas && !msg) return null;
  return (
    <div className="flex flex-col gap-2">
      {quantas ? (
        <Botao
          type="button"
          variante="secundario"
          disabled={pendente}
          className="border-marca! text-marca-forte"
          onClick={() => {
            if (!window.confirm(`Aprovar as ${quantas} devolutiva(s) prontas do jeito que a IA escreveu?`)) return;
            iniciar(async () => {
              setMsg(await aprovarProntas(slug, etapaId));
              router.refresh();
            });
          }}
        >
          {pendente ? "Aprovando…" : `Aprovar as ${quantas} prontas sem editar`}
        </Botao>
      ) : null}
      {msg ? <Aviso tipo={msg.ok ? "info" : "erro"}>{msg.mensagem}</Aviso> : null}
    </div>
  );
}

/**
 * Topo da folha da equipe: conceito (um toque) + devolutiva editável, com a
 * barra “Salvar | Aprovar” fixa no rodapé da tela. `children` (checklist,
 * arquivos, detalhes) fica entre os dois.
 */
export function FolhaDevolutiva({
  slug,
  entregaId,
  conceito,
  conceitoIa,
  devolutiva,
  aprovada,
  aprovadaEm,
  destinatario,
  proxima,
  painel,
  envio,
  gmail,
  destinos,
  conectarHref,
  children,
}: {
  slug: string;
  entregaId: string;
  conceito: string;
  conceitoIa: string | null;
  devolutiva: string;
  aprovada: boolean;
  aprovadaEm: string;
  destinatario: string;
  proxima: string | null;
  painel: string;
  envio: { enviada: boolean; em: string; para: string[]; erro: string };
  /** configurado: o servidor tem as chaves do Google; email: Gmail conectado (null = não conectado). */
  gmail: { configurado: boolean; email: string | null };
  destinos: { para: string[]; copia: string[] };
  conectarHref: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [escolhido, setEscolhido] = useState(conceito);
  const [estado, enviar, enviando] = useActionState<Resultado, FormData>(revisarDevolutiva.bind(null, slug, entregaId), null);
  const [reabrindo, iniciarReabrir] = useTransition();
  const idForm = `devolutiva-${entregaId}`;
  const ocupado = enviando || reabrindo;
  return (
    <div className="flex flex-col gap-3">
      <form
        id={idForm}
        onSubmit={(e) => {
          e.preventDefault();
          const submissor = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const dados = new FormData(e.currentTarget, submissor);
          startTransition(() => enviar(dados));
        }}
      >
        <section aria-label="Conceito e devolutiva" className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id={`${idForm}-conceito`} className="text-[13px] font-semibold uppercase tracking-wide text-suave">
              Conceito
            </h2>
            {conceitoIa ? (
              <span className="text-xs text-suave">
                IA sugeriu <strong className="text-texto">{conceitoIa}</strong>
              </span>
            ) : null}
          </div>
          <input type="hidden" name="conceito" value={escolhido} />
          <div role="radiogroup" aria-labelledby={`${idForm}-conceito`} className="grid grid-cols-4 gap-1">
            {CONCEITOS_REVISAO.map((c) => {
              const marcado = c === escolhido;
              const e = ESTILO_CONCEITO[c];
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={marcado}
                  disabled={aprovada || ocupado}
                  onClick={() => setEscolhido(c)}
                  className={`min-h-11 rounded-[10px] px-0.5 text-[11.5px] font-bold tracking-wide sm:text-sm ${
                    marcado ? `border-2 ${e.borda} ${e.fundo} ${e.texto}` : "border border-borda bg-cartao text-suave hover:text-texto"
                  } ${aprovada && !marcado ? "opacity-45" : ""}`}
                >
                  {c}
                </button>
              );
            })}
          </div>
          {!aprovada ? (
            <button
              type="button"
              role="radio"
              aria-checked={escolhido === "PENDENTE"}
              onClick={() => setEscolhido(escolhido === "PENDENTE" ? (conceitoIa ?? "BOM") : "PENDENTE")}
              className={`self-start text-xs underline-offset-2 hover:underline ${escolhido === "PENDENTE" ? "font-semibold text-texto" : "text-suave"}`}
            >
              {escolhido === "PENDENTE" ? "Marcado como PENDENTE (toque para desfazer)" : "Ou deixar PENDENTE"}
            </button>
          ) : null}

          {aprovada ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-marca-clara px-3 py-2 text-sm font-semibold text-marca-forte">
              <span className="flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
                Aprovada · {conceito}
              </span>
              <span className="text-xs font-normal">{aprovadaEm}</span>
            </div>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-suave">Devolutiva para {destinatario}</span>
            <textarea
              name="devolutiva"
              rows={7}
              defaultValue={devolutiva}
              readOnly={aprovada}
              maxLength={10000}
              className={`w-full rounded-xl border border-borda px-3 py-2.5 text-base leading-relaxed text-texto ${aprovada ? "bg-fundo" : "bg-cartao"}`}
            />
          </label>
          {aprovada ? (
            <div className="flex flex-col gap-2 rounded-xl border border-borda p-3 text-sm">
              {envio.enviada ? (
                <p className="break-words font-semibold text-marca-forte">
                  Enviada em {envio.em} para {envio.para.join(", ")}
                </p>
              ) : (
                <p className="break-words">
                  <span className="text-suave">Vai para:</span> {destinos.para.join(", ") || "ninguém (cadastre os e-mails dos integrantes)"}
                  {destinos.copia.length ? (
                    <>
                      {" "}
                      <span className="text-suave">· cópia:</span> {destinos.copia.join(", ")}
                    </>
                  ) : null}
                </p>
              )}
              {envio.erro ? <Aviso tipo="erro">O último envio falhou: {envio.erro}</Aviso> : null}
              <p className="text-xs text-suave">
                {!gmail.configurado
                  ? "O envio por e-mail ainda não foi configurado no servidor. Por enquanto, copie o texto."
                  : gmail.email
                    ? `Sai do seu Gmail (${gmail.email}), na mesma conversa do e-mail da entrega.`
                    : "Conecte seu Gmail para enviar daqui. O Handback só envia; não lê sua caixa."}
              </p>
              <div className="flex flex-wrap gap-2">
                <BotaoCopiar texto={devolutiva} />
                {envio.enviada && gmail.configurado && gmail.email ? (
                  <BotaoEnviar slug={slug} entregaId={entregaId} texto="Enviar de novo" variante="secundario" conectarHref={conectarHref} perguntar="Enviar esta devolutiva de novo?" />
                ) : null}
              </div>
            </div>
          ) : (
            <span className="text-xs text-suave">Nada é enviado sem a sua aprovação.</span>
          )}
          {estado ? <Aviso tipo={estado.ok ? "info" : "erro"}>{estado.mensagem}</Aviso> : null}
        </section>
      </form>

      {children}

      <div className="sticky bottom-0 z-10 -mx-4 grid grid-cols-2 items-start gap-2 border-t border-borda bg-cartao px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-2xl sm:border">
        {aprovada ? (
          <>
            <Botao
              type="button"
              variante="secundario"
              disabled={ocupado}
              onClick={() =>
                iniciarReabrir(async () => {
                  await reabrirDevolutiva(slug, entregaId);
                  router.refresh();
                })
              }
            >
              {reabrindo ? "Reabrindo…" : "Reabrir para editar"}
            </Botao>
            {!envio.enviada && gmail.configurado && gmail.email && destinos.para.length ? (
              <BotaoEnviar slug={slug} entregaId={entregaId} conectarHref={conectarHref} />
            ) : !envio.enviada && gmail.configurado && !gmail.email ? (
              <a
                href={conectarHref}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-marca px-4 font-medium text-sobre-marca hover:bg-marca-forte"
              >
                Conectar meu Gmail
              </a>
            ) : (
              <LinkBotao href={proxima ?? painel}>{proxima ? "Seguinte →" : "Voltar ao painel"}</LinkBotao>
            )}
          </>
        ) : (
          <>
            <Botao type="submit" form={idForm} name="acao" value="salvar" variante="secundario" disabled={ocupado}>
              Salvar rascunho
            </Botao>
            <Botao type="submit" form={idForm} name="acao" value="aprovar" disabled={ocupado}>
              {enviando ? "Salvando…" : "Aprovar devolutiva"}
            </Botao>
          </>
        )}
      </div>
    </div>
  );
}

export function BotaoCopiar({ texto, rotulo = "Copiar devolutiva" }: { texto: string; rotulo?: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Botao
      type="button"
      variante="secundario"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2500);
        } catch {
          setCopiado(false);
        }
      }}
    >
      {copiado ? "Copiado ✓" : rotulo}
    </Botao>
  );
}

"use client";
import { useConfirmar } from "./confirmar";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { registrarEntregaManual, type ArquivoEnviado } from "@/app/app/[slug]/entregas/acoes";
import { Aviso, Botao } from "./ui";
import { nomeArquivoSeguro, tamanhoLegivel } from "@/lib/textos";

const LIMITE_ARQUIVO = 50 * 1024 * 1024; // 50 MB (o mesmo da área de arquivos)
const MAX_ARQUIVOS = 20;

export type OpcaoEtapa = { id: string; rotulo: string; detalhe: string };

/**
 * Registro de entrega à mão (por quem avalia): arquivos sobem direto do
 * aparelho para a área privada (sem passar pelo servidor do site) e, no fim,
 * a entrega é registrada de uma vez.
 */
export function FormEntrega({
  slug,
  orgId,
  supabaseConfig,
  etapas,
  grupos,
  etapaInicial,
  nomeEtapa,
  nomeGrupo,
}: {
  slug: string;
  orgId: string;
  supabaseConfig: { url: string; chave: string };
  etapas: OpcaoEtapa[];
  grupos: { id: string; nome: string }[];
  etapaInicial?: string;
  nomeEtapa: string;
  nomeGrupo: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [resultado, setResultado] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const { pedir, janela } = useConfirmar();

  function escolherArquivos(lista: FileList | null) {
    const novos = Array.from(lista ?? []);
    const grandes = novos.filter((f) => f.size > LIMITE_ARQUIVO);
    if (grandes.length) {
      setResultado({ ok: false, mensagem: `Arquivo grande demais (máximo 50 MB): ${grandes.map((f) => f.name).join(", ")}` });
    } else {
      setResultado(null);
    }
    setArquivos((atuais) => [...atuais, ...novos.filter((f) => f.size <= LIMITE_ARQUIVO)].slice(0, MAX_ARQUIVOS));
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const etapaId = String(dados.get("etapa") ?? "");
    const grupoId = String(dados.get("grupo") ?? "");
    if (!etapaId || !grupoId) {
      setResultado({ ok: false, mensagem: `Escolha: ${nomeEtapa.toLowerCase()} e ${nomeGrupo.toLowerCase()}.` });
      return;
    }
    if (!(await pedir({ titulo: "Registrar esta entrega?", texto: arquivos.length ? `Com ${arquivos.length === 1 ? "1 arquivo" : `${arquivos.length} arquivos`}.` : undefined, sim: "Sim, registrar" }))) return;

    setEnviando(true);
    setResultado(null);
    const id = crypto.randomUUID();
    const supabase = createBrowserClient(supabaseConfig.url, supabaseConfig.chave);
    const enviados: ArquivoEnviado[] = [];

    try {
      for (const [i, arquivo] of arquivos.entries()) {
        setProgresso(`Enviando arquivo ${i + 1} de ${arquivos.length}…`);
        const caminho = `${orgId}/manual/${id}/${i + 1}-${nomeArquivoSeguro(arquivo.name)}`;
        const { error } = await supabase.storage.from("entregas").upload(caminho, arquivo, {
          contentType: arquivo.type || "application/octet-stream",
          upsert: false,
        });
        if (error) throw new Error(`Não foi possível enviar “${arquivo.name}”. Confira a internet e tente de novo.`);
        enviados.push({ caminho, nome: arquivo.name, tamanho: arquivo.size, tipo: arquivo.type });
      }

      setProgresso("Registrando a entrega…");
      const r = await registrarEntregaManual(slug, {
        id,
        etapaId,
        grupoId,
        comentario: String(dados.get("comentario") ?? "").trim(),
        links: String(dados.get("links") ?? ""),
        arquivos: enviados,
      });
      setResultado(r);
      if (r.ok) {
        formRef.current?.reset();
        setArquivos([]);
        router.refresh();
      }
    } catch (erro) {
      setResultado({ ok: false, mensagem: erro instanceof Error ? erro.message : "Algo deu errado. Tente de novo." });
    } finally {
      setEnviando(false);
      setProgresso("");
    }
  }

  const unicoGrupo = grupos.length === 1 ? grupos[0] : null;

  return (
    <form ref={formRef} onSubmit={enviar} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{nomeEtapa}</span>
        <select
          name="etapa"
          aria-label={nomeEtapa}
          required
          defaultValue={etapaInicial ?? ""}
          className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
        >
          <option value="" disabled>
            Escolha…
          </option>
          {etapas.map((et) => (
            <option key={et.id} value={et.id}>
              {et.rotulo} — {et.detalhe}
            </option>
          ))}
        </select>
      </label>

      {unicoGrupo ? (
        <input type="hidden" name="grupo" value={unicoGrupo.id} />
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{nomeGrupo}</span>
          <select
            name="grupo"
            aria-label={nomeGrupo}
            required
            defaultValue=""
            className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
          >
            <option value="" disabled>
              Escolha…
            </option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Arquivos</span>
        <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-borda bg-cartao px-3 py-3 text-center text-sm text-suave hover:border-marca">
          <input
            type="file"
            multiple
            className="sr-only"
            aria-label="Escolher arquivos"
            onChange={(ev) => {
              escolherArquivos(ev.currentTarget.files);
              ev.currentTarget.value = "";
            }}
          />
          Toque para escolher arquivos (até {MAX_ARQUIVOS}, 50 MB cada)
        </label>
        {arquivos.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {arquivos.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-fundo px-3 py-2">
                <span className="min-w-0 break-all">
                  {f.name} <span className="text-suave">· {tamanhoLegivel(f.size)}</span>
                </span>
                <button
                  type="button"
                  className="shrink-0 text-erro"
                  aria-label={`Tirar ${f.name}`}
                  onClick={() => setArquivos((atuais) => atuais.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Links (opcional)</span>
        <textarea
          name="links"
          rows={2}
          placeholder="Um por linha. Ex.: https://www.figma.com/…"
          className="w-full rounded-xl border border-borda bg-cartao px-3 py-2 text-base text-texto placeholder:text-suave"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Comentário (opcional)</span>
        <textarea
          name="comentario"
          rows={3}
          maxLength={5000}
          className="w-full rounded-xl border border-borda bg-cartao px-3 py-2 text-base text-texto"
        />
      </label>

      {progresso ? <Aviso>{progresso}</Aviso> : null}
      {resultado ? <Aviso tipo={resultado.ok ? "info" : "erro"}>{resultado.mensagem}</Aviso> : null}
      <Botao type="submit" disabled={enviando}>
        {enviando ? "Registrando…" : "Registrar entrega"}
      </Botao>
      {janela}
    </form>
  );
}

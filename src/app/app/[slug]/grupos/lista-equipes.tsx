"use client";

import { useMemo, useState, useTransition } from "react";
import { useConfirmar } from "@/components/confirmar";
import { Vazio } from "@/components/ui";
import { apagarGrupos } from "./acoes";
import { CartaoGrupo, semAcento, type Pessoa } from "./cartao-grupo";

type Grupo = { id: string; nome: string; tema: string | null; ativo: boolean; doMoodle: boolean; pessoas: Pessoa[] };

/**
 * Lista das equipes (ou pessoas): fechadas por padrão, com busca por nome de
 * equipe ou de aluno e "Selecionar" para apagar várias de uma vez.
 */
export function ListaEquipes({ slug, grupos, podeGerir, palavra, varios }: { slug: string; grupos: Grupo[]; podeGerir: boolean; palavra: string; varios: string }) {
  const [busca, setBusca] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState("");
  const [apagando, iniciar] = useTransition();
  const { pedir, janela } = useConfirmar();
  const q = semAcento(busca.trim());

  // Equipes que batem com a busca; as que batem só por um aluno abrem sozinhas.
  const { visiveis, porPessoa } = useMemo(() => {
    if (!q) return { visiveis: grupos, porPessoa: new Set<string>() };
    const porPessoa = new Set<string>();
    const visiveis = grupos.filter((g) => {
      if (semAcento(`${g.nome} ${g.tema ?? ""}`).includes(q)) return true;
      const achou = g.pessoas.some((p) => semAcento(`${p.nome} ${p.email}`).includes(q));
      if (achou) porPessoa.add(g.id);
      return achou;
    });
    return { visiveis, porPessoa };
  }, [grupos, q]);

  const alternar = (id: string, conjunto: Set<string>, mudar: (s: Set<string>) => void) => {
    const novo = new Set(conjunto);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    mudar(novo);
  };
  const selecionados = grupos.filter((g) => marcados.has(g.id));
  const plural = varios.toLowerCase();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label className="flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-borda bg-cartao px-3 focus-within:border-marca">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="shrink-0 text-suave">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Procurar ${palavra.toLowerCase()} ou aluno`}
            aria-label={`Procurar ${palavra.toLowerCase()} ou aluno`}
            className="min-w-0 flex-1 bg-transparent text-base text-texto outline-none placeholder:text-suave"
          />
        </label>
        {podeGerir && grupos.length ? (
          <button
            type="button"
            aria-pressed={selecionando}
            onClick={() => {
              setSelecionando((x) => !x);
              setMarcados(new Set());
              setAviso("");
            }}
            className={`min-h-12 shrink-0 rounded-xl px-3 text-sm font-semibold ${selecionando ? "bg-marca text-sobre-marca" : "border border-borda bg-cartao text-texto hover:bg-fundo"}`}
          >
            {selecionando ? "Cancelar" : "Selecionar"}
          </button>
        ) : null}
      </div>

      {aviso ? (
        <p role="status" className="rounded-xl bg-marca-clara px-3 py-2 text-sm font-semibold text-marca-forte">
          {aviso}
        </p>
      ) : null}

      {selecionando ? (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-suave">Toque para marcar.</span>
          <button
            type="button"
            onClick={() => setMarcados(marcados.size === visiveis.length ? new Set() : new Set(visiveis.map((g) => g.id)))}
            className="min-h-10 rounded-lg px-2 font-semibold text-marca-forte hover:underline"
          >
            {marcados.size === visiveis.length && visiveis.length ? "Desmarcar todas" : q ? "Marcar as encontradas" : "Marcar todas"}
          </button>
        </div>
      ) : null}

      {!grupos.length ? (
        <Vazio>Nada cadastrado ainda.{podeGerir ? " Use os botões acima para adicionar." : ""}</Vazio>
      ) : !visiveis.length ? (
        <p className="py-6 text-center text-sm text-suave">Ninguém com esse nome.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:items-start">
          {visiveis.map((g) => (
            <CartaoGrupo
              key={g.id}
              slug={slug}
              podeGerir={podeGerir}
              palavra={palavra}
              doMoodle={g.doMoodle}
              g={g}
              aberto={abertos.has(g.id) || porPessoa.has(g.id)}
              alternar={() => alternar(g.id, abertos, setAbertos)}
              selecionando={selecionando}
              marcado={marcados.has(g.id)}
              marcar={() => alternar(g.id, marcados, setMarcados)}
              realce={q}
            />
          ))}
        </ul>
      )}

      {selecionando && selecionados.length ? (
        <div className="sticky bottom-24 z-20 flex items-center justify-between gap-3 rounded-2xl border border-borda bg-cartao px-4 py-3 shadow-lg lg:bottom-4">
          <span className="text-sm font-semibold">
            {selecionados.length} {selecionados.length === 1 ? "selecionada" : "selecionadas"}
          </span>
          <button
            type="button"
            disabled={apagando}
            onClick={async () => {
              const nomes = selecionados.map((g) => g.nome);
              const moodle = selecionados.some((g) => g.doMoodle);
              const ok = await pedir({
                titulo: `Apagar ${selecionados.length === 1 ? `“${nomes[0]}”` : `${selecionados.length} ${plural}`}?`,
                texto: `${nomes.slice(0, 8).join(", ")}${nomes.length > 8 ? ` e mais ${nomes.length - 8}` : ""}. As entregas também são apagadas.${moodle ? " As que vieram do Moodle vão para “Apagadas” e podem voltar." : ""}`,
                sim: "Sim, apagar",
                perigo: true,
              });
              if (!ok) return;
              iniciar(async () => {
                const r = await apagarGrupos(slug, selecionados.map((g) => g.id));
                setAviso(r.mensagem);
                setMarcados(new Set());
                setSelecionando(false);
              });
            }}
            className="inline-flex min-h-11 items-center rounded-xl bg-erro px-4 text-sm font-bold text-cartao disabled:opacity-60"
          >
            {apagando ? "Apagando…" : `Apagar ${selecionados.length}`}
          </button>
        </div>
      ) : null}
      {janela}
    </div>
  );
}

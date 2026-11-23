"use client";

import { useState } from "react";
import { SinalSalvo, useSalvar } from "@/components/campo-auto";
import { generoDe, plural } from "@/lib/nomes";
import { salvarMedia } from "./acoes";

type Tipo = "um" | "turma" | "planilha" | "moodle";

/** Escolhe o relatório e as opções; os botões abrem o PDF (para imprimir/salvar) ou baixam a planilha. */
export function EscolhaRelatorio({
  slug,
  grupos,
  palavraGrupo,
  palavraGrupos,
  palavraMatricula,
  palavraEtapa,
  temMoodle,
}: {
  slug: string;
  grupos: { id: string; nome: string }[];
  palavraGrupo: string;
  palavraGrupos: string;
  palavraMatricula: string;
  palavraEtapa: string;
  temMoodle: boolean;
}) {
  const et = palavraEtapa.toLowerCase();
  const [tipo, setTipo] = useState<Tipo>("um");
  const [grupo, setGrupo] = useState(grupos[0]?.id ?? "todas");
  const [aulas, setAulas] = useState<"todas" | "encerradas">("todas");
  const [dev, setDev] = useState(true);
  const [check, setCheck] = useState(true);
  const [mat, setMat] = useState(false);
  const base = `/app/${slug}/relatorios`;
  const q = (extra: Record<string, string>) => new URLSearchParams({ aulas, ...extra }).toString();
  const opcoesPdf = { dev: dev ? "1" : "0", check: check ? "1" : "0", mat: mat ? "1" : "0" };
  const tipos: { id: Tipo; nome: string; detalhe: string; formato: string }[] = [
    { id: "um", nome: `${palavraGrupo} por ${palavraGrupo.toLowerCase()}`, detalhe: `Evolução ${et} a ${et}, conceitos e devolutivas`, formato: "PDF" },
    { id: "turma", nome: "A turma inteira", detalhe: "Como foram os conceitos e quem precisa de atenção", formato: "PDF" },
    { id: "planilha", nome: "Planilha da turma", detalhe: `Uma linha por aluno, uma coluna por ${et}`, formato: "Excel · CSV" },
    ...(temMoodle ? [{ id: "moodle" as Tipo, nome: "Notas para o Moodle", detalhe: "Arquivo para importar no livro de notas do Moodle", formato: "CSV" }] : []),
  ];
  const destino =
    tipo === "um"
      ? { href: `${base}/equipe?${q({ g: grupo, ...opcoesPdf })}`, rotulo: "Abrir o PDF", baixar: false }
      : tipo === "turma"
        ? { href: `${base}/turma?${q(opcoesPdf)}`, rotulo: "Abrir o PDF da turma", baixar: false }
        : tipo === "planilha"
          ? { href: `${base}/planilha?${q({ formato: "xlsx", mat: mat ? "1" : "0" })}`, rotulo: "Baixar planilha (Excel)", baixar: true }
          : { href: `${base}/planilha?${q({ formato: "moodle" })}`, rotulo: "Baixar arquivo para o Moodle", baixar: true };

  const caixa = "flex min-h-12 cursor-pointer items-center gap-3 border-t border-borda py-1 text-sm first-of-type:border-t-0";
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">O que você quer</legend>
        {tipos.map((t) => (
          <label
            key={t.id}
            className={`flex min-h-16 cursor-pointer items-center justify-between gap-3 rounded-2xl bg-cartao px-4 py-3 ${tipo === t.id ? "border-2 border-marca" : "border border-borda"}`}
          >
            <input type="radio" name="tipo" className="sr-only" checked={tipo === t.id} onChange={() => setTipo(t.id)} />
            <span className="flex flex-col">
              <span className="font-semibold">{t.nome}</span>
              <span className="text-xs text-suave">{t.detalhe}</span>
            </span>
            <span className="shrink-0 rounded-full bg-marca-clara px-2.5 py-0.5 text-[11px] font-bold text-marca-forte">{t.formato}</span>
          </label>
        ))}
      </fieldset>

      {tipo === "um" ? (
        <label className="entra flex flex-col gap-1.5 text-sm font-semibold">
          Qual {palavraGrupo.toLowerCase()}
          <select value={grupo} onChange={(e) => setGrupo(e.target.value)} className="min-h-11 rounded-xl border border-borda bg-cartao px-3 text-base font-normal">
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
            <option value="todas">Todas ({palavraGrupos.toLowerCase()}), uma folha para cada</option>
          </select>
        </label>
      ) : null}

      <section aria-label="Opções" className="flex flex-col rounded-2xl border border-borda bg-cartao p-4">
        <h2 className="mb-1 font-semibold">Opções</h2>
        <label className="flex min-h-12 items-center justify-between gap-3 text-sm">
          {plural(palavraEtapa)}
          <select value={aulas} onChange={(e) => setAulas(e.target.value as "todas" | "encerradas")} className="min-h-10 rounded-xl border border-borda bg-cartao px-2.5 text-sm">
            <option value="todas">Todas</option>
            <option value="encerradas">Só as já encerradas</option>
          </select>
        </label>
        {tipo === "um" || tipo === "turma" ? (
          <>
            {tipo === "um" ? (
              <>
                <label className={caixa}>
                  <input type="checkbox" checked={dev} onChange={(e) => setDev(e.target.checked)} className="size-[22px] shrink-0 accent-[var(--marca)]" />
                  <span className="flex flex-col">
                    Devolutivas inteiras<span className="text-xs text-suave">O texto que cada um recebeu</span>
                  </span>
                </label>
                <label className={caixa}>
                  <input type="checkbox" checked={check} onChange={(e) => setCheck(e.target.checked)} className="size-[22px] shrink-0 accent-[var(--marca)]" />
                  <span className="flex flex-col">
                    Checklist de cada {et}<span className="text-xs text-suave">Quantos itens foram entregues</span>
                  </span>
                </label>
              </>
            ) : null}
          </>
        ) : null}
        {tipo !== "moodle" ? (
          <label className={caixa}>
            <input type="checkbox" checked={mat} onChange={(e) => setMat(e.target.checked)} className="size-[22px] shrink-0 accent-[var(--marca)]" />
            <span className="flex flex-col">
              {palavraMatricula} ao lado do nome<span className="text-xs text-suave">Bom para lançar no sistema da escola</span>
            </span>
          </label>
        ) : (
          <p className="border-t border-borda pt-2 text-xs text-suave">
            No Moodle: Notas › Importar › Arquivo CSV. Escolha “Endereço de e-mail” para identificar os alunos. A nota de cada tarefa já vem na escala dela.
          </p>
        )}
      </section>

      <a
        href={destino.href}
        {...(destino.baixar ? { download: "" } : { target: "_blank", rel: "noopener" })}
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-marca-forte font-bold text-sobre-marca hover:bg-marca"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v12" />
          <path d="M7 10l5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        {destino.rotulo}
      </a>
      {tipo === "planilha" ? (
        <a href={`${base}/planilha?${q({ formato: "csv", mat: mat ? "1" : "0" })}`} download="" className="self-center text-sm font-medium text-marca-forte underline">
          Prefiro CSV
        </a>
      ) : null}
      <p className="text-center text-xs text-suave">
        Só entra o que já foi aprovado. A análise interna da IA nunca vai para o relatório.{" "}
        {tipo === "um" || tipo === "turma" ? "O PDF abre numa aba: use “Salvar como PDF” ou imprima." : ""}
      </p>
    </div>
  );
}

function CaixaMedia({ slug, inicial }: { slug: string; inicial: boolean }) {
  const [ligada, setLigada] = useState(inicial);
  const { salvar, estado, erro } = useSalvar(slug, "media_ativa", inicial ? "sim" : "nao", (v) => salvarMedia(slug, "media_ativa", v));
  return (
    <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[15px]">
      <input
        type="checkbox"
        checked={ligada}
        onChange={(e) => {
          setLigada(e.target.checked);
          salvar(e.target.checked ? "sim" : "nao");
        }}
        className="size-[22px] shrink-0 accent-[var(--marca)]"
      />
      <span className="flex flex-wrap items-center gap-2">
        Calcular média final nesta turma
        <SinalSalvo estado={estado} erro={erro} />
      </span>
    </label>
  );
}

function CampoPeso({ slug, id, rotulo, inicial }: { slug: string; id: string; rotulo: string; inicial: number }) {
  const { salvar, estado, erro } = useSalvar(slug, `peso_${id}`, String(inicial), (v) => salvarMedia(slug, `peso_${id}`, v));
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 border-t border-borda text-sm">
      <span className="flex flex-wrap items-center gap-2">
        {rotulo}
        <SinalSalvo estado={estado} erro={erro} />
      </span>
      <input
        type="number"
        min={0}
        max={10}
        step={0.5}
        defaultValue={inicial}
        aria-label={`Peso de ${rotulo}`}
        onBlur={(e) => salvar(e.target.value)}
        className="min-h-10 w-20 rounded-xl border border-borda bg-cartao px-2 text-right text-base"
      />
    </label>
  );
}

/** Média final (opcional): desligada por padrão; quem liga escolhe o peso de cada aula. */
export function ConfigMedia({ slug, ativa, etapas, palavraEtapa }: { slug: string; ativa: boolean; etapas: { id: string; numero: number; titulo: string; peso: number }[]; palavraEtapa: string }) {
  return (
    <section aria-label="Média final (opcional)" className="flex flex-col rounded-2xl border border-borda bg-cartao p-4">
      <h2 className="font-semibold">Média final (opcional)</h2>
      <p className="text-xs text-suave">Desligada, os relatórios mostram só os conceitos. Ligada, entra a média de 0 a 10, com o peso que você der a cada {palavraEtapa.toLowerCase()}.</p>
      <CaixaMedia slug={slug} inicial={ativa} />
      {ativa ? (
        <div className="entra flex flex-col">
          {etapas.map((e) => (
            <CampoPeso key={e.id} slug={slug} id={e.id} rotulo={`${palavraEtapa} ${e.numero} · ${e.titulo}`} inicial={e.peso} />
          ))}
          <p className="pt-2 text-xs text-suave">
            Peso 0 tira {generoDe(palavraEtapa) === "f" ? "a" : "o"} {palavraEtapa.toLowerCase()} da média. Quem não entregou {generoDe(palavraEtapa) === "f" ? "uma" : "um"}{" "}
            {palavraEtapa.toLowerCase()} já encerrad{generoDe(palavraEtapa) === "f" ? "a" : "o"} fica com 0.
          </p>
        </div>
      ) : null}
    </section>
  );
}

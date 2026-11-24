import type { ReactNode } from "react";
import type { Celula, Conceito, EtapaRel, Relatorio } from "@/lib/relatorios";
import { dataHoraBR } from "@/lib/textos";

/**
 * Peças dos relatórios. A folha é sempre "papel" (fundo branco), mesmo no
 * tema escuro, porque é o que vai para a impressora ou para o PDF.
 */
const COR: Record<Conceito, string> = { RUIM: "#b5482b", REGULAR: "#e39a62", BOM: "#5fae9f", EXCELENTE: "#1e40c0" };
const TEXTO_SOBRE: Record<Conceito, string> = { RUIM: "#ffffff", REGULAR: "#0e2b28", BOM: "#0e2b28", EXCELENTE: "#ffffff" };
const NOME: Record<Conceito, string> = { RUIM: "Ruim", REGULAR: "Regular", BOM: "Bom", EXCELENTE: "Excelente" };
const ORDEM: Conceito[] = ["RUIM", "REGULAR", "BOM", "EXCELENTE"];

export function Folha({ children }: { children: ReactNode }) {
  return (
    <article className="folha mx-auto flex w-full max-w-[210mm] flex-col gap-4 rounded-2xl border border-borda bg-white p-6 text-[13px] leading-relaxed text-[#0e2b28] shadow-sm sm:p-10 print:text-[11pt]">
      {children}
    </article>
  );
}

export function Cabecalho({ antes, titulo, depois }: { antes: string; titulo: string; depois?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b-2 border-[#2f5bea] pb-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-[#4b605d]">{antes}</span>
        <h1 className="titulo text-2xl font-extrabold tracking-tight text-[#0e2b28]">{titulo}</h1>
        {depois ? <span className="text-xs text-[#4b605d]">{depois}</span> : null}
      </div>
      <svg width="34" height="34" viewBox="0 0 48 48" fill="none" aria-hidden className="shrink-0">
        <rect width="48" height="48" rx="13.5" fill="#2f5bea" />
        <path d="M13.5 13.5h21a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-12l-6 4.5v-4.5h-3a3 3 0 0 1-3-3v-12a3 3 0 0 1 3-3z" fill="#ffffff" />
        <path d="M18 22.5l4.5 4.5 7.5-7.5" stroke="#2f5bea" strokeWidth="3.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </header>
  );
}

export function Numeros({ itens }: { itens: { rotulo: string; valor: string; detalhe?: string }[] }) {
  return (
    <div className={`grid gap-2.5 ${itens.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}>
      {itens.map((i) => (
        <div key={i.rotulo} className="sem-quebra flex flex-col gap-0.5 rounded-xl bg-[#f5f7fb] px-3 py-2.5">
          <span className="text-xs text-[#4b605d]">{i.rotulo}</span>
          <strong className="text-lg">{i.valor}</strong>
          {i.detalhe ? <span className="text-xs text-[#4b605d]">{i.detalhe}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function Rodape({ r, autor }: { r: Relatorio; autor?: string }) {
  return (
    <footer className="mt-2 flex flex-col gap-0.5 border-t border-[#e8eeec] pt-2 text-[11px] text-[#4b605d]">
      <span>
        Gerado pelo Handback em {dataHoraBR(r.geradoEm)}
        {autor ? ` · ${autor}` : ""} · {r.org.nome}
      </span>
      <span>Contém dados pessoais dos alunos. Uso interno: não compartilhe fora da instituição.</span>
    </footer>
  );
}

/** Conceito aula a aula (uma linha só, com o conceito escrito em cada ponto). */
export function GraficoEvolucao({ celulas, etapas, palavra }: { celulas: Celula[]; etapas: EtapaRel[]; palavra: string }) {
  const L = 560;
  const esq = 70;
  const passo = etapas.length > 1 ? (L - esq - 40) / (etapas.length - 1) : 0;
  const y: Record<Conceito, number> = { EXCELENTE: 20, BOM: 54, REGULAR: 88, RUIM: 122 };
  const pts = celulas
    .map((c, i) => (c.tipo === "aprovado" ? { x: esq + 20 + i * passo, y: y[c.conceito], c: c.conceito, i } : null))
    .filter(Boolean) as { x: number; y: number; c: Conceito; i: number }[];
  const descricao = celulas
    .map((c, i) => `${palavra} ${etapas[i].numero}: ${c.tipo === "aprovado" ? NOME[c.conceito] : c.tipo === "nao-entregou" ? "não entregou" : "sem conceito"}`)
    .join(", ");
  return (
    <svg role="img" aria-label={`Conceito ${palavra.toLowerCase()} a ${palavra.toLowerCase()}. ${descricao}`} viewBox={`0 0 ${L} 152`} className="w-full">
      {(Object.keys(y) as Conceito[]).map((k) => (
        <g key={k}>
          <text x="0" y={y[k] + 4} fontSize="10" fill="#4b605d">
            {NOME[k]}
          </text>
          <line x1={esq} x2={L} y1={y[k]} y2={y[k]} stroke="#e8eeec" />
        </g>
      ))}
      {pts.length > 1 ? <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#2f5bea" strokeWidth="2" strokeLinejoin="round" /> : null}
      {pts.map((p) => (
        <circle key={p.i} cx={p.x} cy={p.y} r="5" fill="#2f5bea" stroke="#ffffff" strokeWidth="2">
          <title>{`${palavra} ${etapas[p.i].numero}: ${NOME[p.c]}`}</title>
        </circle>
      ))}
      {pts.length ? (
        <text x={Math.min(pts.at(-1)!.x + 8, L - 50)} y={pts.at(-1)!.y - 7} fontSize="10" fontWeight="700" fill="#0e2b28">
          {NOME[pts.at(-1)!.c]}
        </text>
      ) : null}
      {etapas.map((e, i) => (
        <text key={e.id} x={esq + 20 + i * passo} y="146" fontSize="10" fill="#4b605d" textAnchor="middle">
          {celulas[i]?.tipo === "nao-entregou" ? "faltou" : `${palavra} ${e.numero}`}
        </text>
      ))}
    </svg>
  );
}

/** Quantos tiraram cada conceito em cada aula (barras empilhadas, com o número escrito). */
export function BarrasTurma({ r }: { r: Relatorio }) {
  const L = 560;
  const esq = 70;
  const larg = L - esq;
  const alt = 22;
  const total = r.grupos.length || 1;
  const linhas = r.etapas.map((e, i) => {
    const conta = Object.fromEntries(ORDEM.map((c) => [c, 0])) as Record<Conceito, number>;
    let faltou = 0;
    for (const g of r.grupos) {
      const c = g.celulas[i];
      if (c?.tipo === "aprovado") conta[c.conceito]++;
      else if (c?.tipo === "nao-entregou") faltou++;
    }
    return { e, conta, faltou };
  });
  const H = linhas.length * (alt + 14) + 4;
  const descricao = linhas
    .map((l) => `${r.vc.etapa} ${l.e.numero}: ${ORDEM.map((c) => `${l.conta[c]} ${NOME[c].toLowerCase()}`).join(", ")}${l.faltou ? `, ${l.faltou} não entregou` : ""}`)
    .join(". ");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3 text-xs text-[#4b605d]">
        {ORDEM.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: COR[c] }} />
            {NOME[c]}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-dashed border-[#8a9b97]" />
          Não entregou
        </span>
      </div>
      <svg role="img" aria-label={`Conceitos em cada ${r.vc.etapa.toLowerCase()}. ${descricao}`} viewBox={`0 0 ${L} ${H}`} className="w-full">
        {linhas.map((l, i) => {
          const y = 4 + i * (alt + 14);
          let x = esq;
          const pedacos = [...ORDEM.map((c) => ({ c, n: l.conta[c] as number })), { c: null as Conceito | null, n: l.faltou }].filter((p) => p.n > 0);
          return (
            <g key={l.e.id}>
              <text x="0" y={y + 15} fontSize="10" fill="#4b605d">
                {r.vc.etapa} {l.e.numero}
              </text>
              {pedacos.map((p, k) => {
                const w = (p.n / total) * larg - 2;
                const x0 = x;
                x += w + 2;
                return (
                  <g key={k}>
                    {p.c ? (
                      <rect x={x0} y={y} width={Math.max(w, 2)} height={alt} rx="4" fill={COR[p.c]}>
                        <title>{`${r.vc.etapa} ${l.e.numero} · ${NOME[p.c]}: ${p.n}`}</title>
                      </rect>
                    ) : (
                      <rect x={x0 + 0.5} y={y + 0.5} width={Math.max(w - 1, 2)} height={alt - 1} rx="4" fill="#ffffff" stroke="#8a9b97" strokeDasharray="3 2">
                        <title>{`${r.vc.etapa} ${l.e.numero} · Não entregou: ${p.n}`}</title>
                      </rect>
                    )}
                    {w > 14 ? (
                      <text x={x0 + w / 2} y={y + 15} fontSize="10" fontWeight="700" textAnchor="middle" fill={p.c ? TEXTO_SOBRE[p.c] : "#4b605d"}>
                        {p.n}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function TextoCelula({ c }: { c: Celula | undefined }) {
  if (!c) return <>—</>;
  if (c.tipo === "aprovado") return <strong>{c.conceito}</strong>;
  if (c.tipo === "nao-entregou") return <span className="text-[#4b605d]">não entregou</span>;
  if (c.tipo === "pendente") return <span className="text-[#4b605d]">em avaliação</span>;
  return <span className="text-[#4b605d]">—</span>;
}

export const dataCurta = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(iso)) : "";

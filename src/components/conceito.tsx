import type { ReactNode } from "react";

/** Peças visuais das entregas: conceito, situação e ícones do checklist. */

export const CONCEITOS_REVISAO = ["EXCELENTE", "BOM", "REGULAR", "RUIM"] as const;

export const ESTILO_CONCEITO: Record<string, { fundo: string; texto: string; borda: string }> = {
  EXCELENTE: { fundo: "bg-exc-fundo", texto: "text-exc", borda: "border-exc" },
  BOM: { fundo: "bg-bom-fundo", texto: "text-bom", borda: "border-bom" },
  REGULAR: { fundo: "bg-reg-fundo", texto: "text-reg", borda: "border-reg" },
  RUIM: { fundo: "bg-ruim-fundo", texto: "text-ruim", borda: "border-ruim" },
  PENDENTE: { fundo: "bg-neutro-fundo", texto: "text-neutro", borda: "border-neutro" },
};

export function SeloConceito({ conceito, grande = false }: { conceito: string | null | undefined; grande?: boolean }) {
  const e = ESTILO_CONCEITO[conceito ?? ""] ?? ESTILO_CONCEITO.PENDENTE;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-lg font-bold tracking-wide ${e.fundo} ${e.texto} ${
        grande ? "px-2.5 py-1.5 text-[13px]" : "px-2 py-1 text-xs"
      }`}
    >
      {conceito || "—"}
    </span>
  );
}

export type Situacao = "revisar" | "aprovada" | "enviada" | "analisando" | "sem-analise" | "falhou" | "nao-entregou" | "aguardando";

export const ROTULO_SITUACAO: Record<Situacao, string> = {
  revisar: "Para revisar",
  aprovada: "Aprovada",
  enviada: "Enviada",
  analisando: "Analisando…",
  "sem-analise": "Sem análise",
  falhou: "Análise falhou",
  "nao-entregou": "Não entregou",
  aguardando: "Aguardando",
};

const ESTILO_SITUACAO: Record<Situacao, string> = {
  revisar: "bg-alerta-fundo text-alerta",
  aprovada: "bg-marca-clara text-marca-forte",
  enviada: "bg-ok-fundo text-ok",
  analisando: "bg-info-fundo text-info",
  "sem-analise": "bg-neutro-fundo text-neutro",
  falhou: "bg-erro-fundo text-erro",
  "nao-entregou": "bg-neutro-fundo text-neutro",
  aguardando: "bg-neutro-fundo text-neutro",
};

export function Pilula({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{children}</span>;
}

export function PilulaSituacao({ situacao }: { situacao: Situacao }) {
  return <Pilula className={ESTILO_SITUACAO[situacao]}>{ROTULO_SITUACAO[situacao]}</Pilula>;
}

export function PilulaAtraso({ atrasada }: { atrasada: boolean }) {
  return atrasada ? <Pilula className="bg-ruim-fundo text-ruim">Atrasada</Pilula> : <Pilula className="bg-marca-clara text-marca-forte">No prazo</Pilula>;
}

export type StatusItem = "ENTREGUE" | "PARCIAL" | "NAO_ENTREGUE";

const ICONE_ITEM: Record<StatusItem, { classe: string; rotulo: string; caminho: string }> = {
  ENTREGUE: { classe: "bg-ok-fundo text-ok", rotulo: "Entregue", caminho: "M5 12.5l4.5 4.5L19 7.5" },
  PARCIAL: { classe: "bg-reg-fundo text-reg", rotulo: "Parcial", caminho: "M6 12h12" },
  NAO_ENTREGUE: { classe: "bg-ruim-fundo text-ruim", rotulo: "Não entregue", caminho: "M7 7l10 10M17 7L7 17" },
};

/** Ícone do item do checklist (forma e cor diferentes, para quem não distingue cores). */
export function IconeItem({ status }: { status: StatusItem }) {
  const i = ICONE_ITEM[status] ?? ICONE_ITEM.NAO_ENTREGUE;
  return (
    <span className={`flex size-6 shrink-0 items-center justify-center rounded-full ${i.classe}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={i.rotulo}>
        <path d={i.caminho} />
      </svg>
    </span>
  );
}

/** Seção-cartão com título pequeno em maiúsculas. */
export function Bloco({ titulo, extra, children, rotulo }: { titulo: string; extra?: ReactNode; children: ReactNode; rotulo?: string }) {
  return (
    <section aria-label={rotulo ?? titulo} className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-suave">{titulo}</h2>
        {extra ? <span className="text-xs text-suave">{extra}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** Seção que abre e fecha (fica fechada por padrão). */
export function Dobra({ titulo, extra, children, aberta = false }: { titulo: string; extra?: ReactNode; children: ReactNode; aberta?: boolean }) {
  return (
    <details open={aberta} className="group rounded-2xl border border-borda bg-cartao">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-suave transition-transform group-open:rotate-90">
            <path d="M9 6l6 6-6 6" />
          </svg>
          {titulo}
        </span>
        {extra ? <span className="text-xs font-medium text-suave">{extra}</span> : null}
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4 text-sm">{children}</div>
    </details>
  );
}

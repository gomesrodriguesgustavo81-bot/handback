import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Peças visuais simples, reaproveitadas em todas as telas. */

export function Cartao({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-2xl border border-borda bg-cartao p-5 ${className}`} {...props} />;
}

export function Botao({
  variante = "primario",
  className = "",
  ...props
}: ComponentProps<"button"> & { variante?: "primario" | "secundario" }) {
  const estilo =
    variante === "primario"
      ? "bg-marca text-sobre-marca hover:bg-marca-forte"
      : "border border-borda bg-cartao text-texto hover:bg-fundo";
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-medium transition-colors disabled:opacity-60 ${estilo} ${className}`}
      {...props}
    />
  );
}

export function Campo({
  rotulo,
  dica,
  ...props
}: ComponentProps<"input"> & { rotulo: string; dica?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{rotulo}</span>
      <input
        className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto placeholder:text-suave"
        {...props}
      />
      {dica ? <span className="text-xs text-suave">{dica}</span> : null}
    </label>
  );
}

export function Aviso({ tipo = "info", children }: { tipo?: "info" | "alerta" | "erro"; children: ReactNode }) {
  const estilo = {
    info: "border-marca/30 bg-marca-clara text-texto",
    alerta: "border-alerta/30 bg-alerta-fundo text-alerta",
    erro: "border-erro/30 bg-erro-fundo text-erro",
  }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${estilo}`}>
      {children}
    </div>
  );
}

export function Selo({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-marca-clara px-2.5 py-0.5 text-xs font-medium text-marca-forte">
      {children}
    </span>
  );
}

export function AreaTexto({
  rotulo,
  dica,
  ...props
}: ComponentProps<"textarea"> & { rotulo: string; dica?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{rotulo}</span>
      <textarea
        rows={4}
        className="w-full rounded-xl border border-borda bg-cartao px-3 py-2 text-base text-texto placeholder:text-suave"
        {...props}
      />
      {dica ? <span className="text-xs text-suave">{dica}</span> : null}
    </label>
  );
}

export function Escolha({
  rotulo,
  dica,
  opcoes,
  ...props
}: ComponentProps<"select"> & { rotulo: string; dica?: string; opcoes: { valor: string; nome: string }[] }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{rotulo}</span>
      <select className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto" {...props}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.nome}
          </option>
        ))}
      </select>
      {dica ? <span className="text-xs text-suave">{dica}</span> : null}
    </label>
  );
}

/** Link com cara de botão. */
export function LinkBotao({
  variante = "primario",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variante?: "primario" | "secundario" }) {
  const estilo =
    variante === "primario"
      ? "bg-marca text-sobre-marca hover:bg-marca-forte"
      : "border border-borda bg-cartao text-texto hover:bg-fundo";
  return (
    <Link
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-medium transition-colors ${estilo} ${className}`}
      {...props}
    />
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-borda p-6 text-center text-suave">{children}</div>;
}

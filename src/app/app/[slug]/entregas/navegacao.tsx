import Link from "next/link";

/** Alternador “Painel da aula | Caixa de e-mails (n)”. */
export function NavEntregas({ slug, atual, paraConfirmar }: { slug: string; atual: "painel" | "caixa"; paraConfirmar: number }) {
  const item = (ativo: boolean) =>
    `flex min-h-10 items-center justify-center gap-1.5 rounded-[9px] text-sm ${
      ativo ? "bg-cartao font-semibold text-texto shadow-sm" : "font-medium text-suave hover:text-texto"
    }`;
  return (
    <nav aria-label="Entregas" className="grid grid-cols-2 gap-1 rounded-xl bg-neutro-fundo p-1 sm:max-w-md">
      <Link href={`/app/${slug}/entregas`} aria-current={atual === "painel" ? "page" : undefined} className={item(atual === "painel")}>
        Painel da aula
      </Link>
      <Link href={`/app/${slug}/entregas/caixa`} aria-current={atual === "caixa" ? "page" : undefined} className={item(atual === "caixa")}>
        Caixa de e-mails
        {paraConfirmar ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-marca px-1.5 text-xs font-semibold text-sobre-marca">
            <span className="sr-only">, </span>
            {paraConfirmar}
            <span className="sr-only"> para confirmar</span>
          </span>
        ) : null}
      </Link>
    </nav>
  );
}

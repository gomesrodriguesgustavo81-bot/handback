import Link from "next/link";

/** Símbolo do Handback: o balão da devolutiva com um visto, num quadrado azul. */
export function SimboloHandback({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" fill="none" aria-hidden className="shrink-0">
      <rect width="32" height="32" rx="9" fill="#2f5bea" />
      <path d="M9 9h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4 3v-3H9a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" fill="#ffffff" />
      <path d="M12 15l3 3 5-5" stroke="#2f5bea" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Logotipo: símbolo + "handback" na letra da marca. */
export function Marca({ tamanho = "md", href = "/" }: { tamanho?: "md" | "lg"; href?: string }) {
  const grande = tamanho === "lg";
  return (
    <Link
      href={href}
      className="group inline-flex shrink-0 items-center gap-2 text-texto"
      aria-label={href === "/" ? "Handback, página inicial" : "Handback, início"}
    >
      <span className="transition-transform duration-500 ease-out group-hover:-rotate-6">
        <SimboloHandback tamanho={grande ? 40 : 30} />
      </span>
      <span className={`titulo font-extrabold tracking-[-0.03em] ${grande ? "text-[30px]" : "text-[21px]"}`}>handback</span>
    </Link>
  );
}

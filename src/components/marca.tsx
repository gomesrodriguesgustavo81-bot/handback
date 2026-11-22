import Link from "next/link";

/** Símbolo do Handback: o círculo que vai e volta (a entrega chega, a devolutiva sai) com um visto. */
export function SimboloHandback({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 48 48" fill="none" aria-hidden className="shrink-0">
      <circle cx="24" cy="24" r="22" fill="#c6f15a" />
      <path d="M34 18a11 11 0 1 0 1.5 9" stroke="#0e3b37" strokeWidth="4" strokeLinecap="round" />
      <path d="M35 10v8.5h-8.5" stroke="#0e3b37" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 24.5l4 4 7.5-8.5" stroke="#0e3b37" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
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
      <span className="transition-transform duration-500 ease-out group-hover:-rotate-[25deg]">
        <SimboloHandback tamanho={grande ? 40 : 30} />
      </span>
      <span className={`titulo font-extrabold tracking-[-0.04em] ${grande ? "text-[30px]" : "text-[21px]"}`}>handback</span>
    </Link>
  );
}

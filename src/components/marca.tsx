import Link from "next/link";

/** Logotipo: "handback" em minúsculas com um ✓ no lugar de destaque. */
export function Marca({ tamanho = "md", href = "/" }: { tamanho?: "md" | "lg"; href?: string }) {
  const grande = tamanho === "lg";
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-2 font-semibold tracking-tight text-texto" aria-label={href === "/" ? "Handback, página inicial" : "Handback, início"}>
      <span
        aria-hidden
        className={`inline-flex items-center justify-center rounded-lg bg-marca text-sobre-marca ${grande ? "h-9 w-9 text-lg" : "h-7 w-7 text-sm"}`}
      >
        ✓
      </span>
      <span className={grande ? "text-2xl" : "text-lg"}>handback</span>
    </Link>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Abas da empresa. Rolam para o lado no celular quando não cabem. */
export function AbasEmpresa({ abas }: { abas: { href: string; nome: string; exato?: boolean }[] }) {
  const caminho = usePathname();
  return (
    <nav aria-label="Seções da empresa" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-borda">
        {abas.map((a) => {
          const ativa = a.exato ? caminho === a.href : caminho === a.href || caminho.startsWith(a.href + "/");
          return (
            <li key={a.href}>
              <Link
                href={a.href}
                aria-current={ativa ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium ${
                  ativa ? "border-marca text-marca-forte" : "border-transparent text-suave hover:text-texto"
                }`}
              >
                {a.nome}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

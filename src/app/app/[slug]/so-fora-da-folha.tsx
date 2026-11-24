"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Esconde o conteúdo dentro da folha de uma entrega (lá o espaço do celular é do conceito e do checklist). */
export function SoForaDaFolha({ children, foraDoInicio = false }: { children: ReactNode; /** Some também no Início (lá aparecem todas as turmas). */ foraDoInicio?: boolean }) {
  const caminho = usePathname();
  if (/\/entregas\/[0-9a-f-]{36}$/i.test(caminho)) return null;
  if (foraDoInicio && /^\/app\/[^/]+\/inicio$/.test(caminho)) return null;
  return <>{children}</>;
}

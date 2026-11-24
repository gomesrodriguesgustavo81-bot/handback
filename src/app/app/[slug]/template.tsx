import { ViewTransition } from "react";

/**
 * Cada página nova entra com movimento: trocar de aba = troca rápida;
 * entrar num item = vem da direita; voltar = vem da esquerda.
 * (O template monta de novo a cada navegação; o layout não.)
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "troca" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "troca" }}
      default="none"
    >
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </ViewTransition>
  );
}

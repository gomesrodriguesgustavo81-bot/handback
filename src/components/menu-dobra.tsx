"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Menu que abre num toque e fecha ao tocar fora, ao escolher um item ou com Esc. */
export function MenuDobra({ rotulo, children, className = "" }: { rotulo: ReactNode; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const fora = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ref.current) ref.current.open = false;
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, []);
  return (
    <details ref={ref} className={`relative shrink-0 ${className}`}>
      <summary className="toque flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-xl border border-borda bg-cartao px-3.5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        {rotulo}
      </summary>
      <div
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) ref.current?.removeAttribute("open");
        }}
        className="cresce absolute right-0 z-40 mt-2 flex w-64 flex-col gap-0.5 rounded-2xl border border-borda bg-cartao p-2 shadow-lg"
      >
        {children}
      </div>
    </details>
  );
}

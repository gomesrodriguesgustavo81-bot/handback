import Link from "next/link";

/** Rodapé das páginas públicas, com os links que o Google e a LGPD pedem. */
export function Rodape() {
  return (
    <footer className="border-t border-borda py-6 text-sm text-suave">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 sm:px-6">
        <span>© {new Date().getFullYear()} Handback</span>
        <Link href="/privacidade" className="hover:text-texto hover:underline">
          Política de privacidade
        </Link>
        <Link href="/termos" className="hover:text-texto hover:underline">
          Termos de uso
        </Link>
        <Link href="/cookies" className="hover:text-texto hover:underline">
          Cookies
        </Link>
      </div>
    </footer>
  );
}

/** Endereço de contato mostrado nas páginas públicas (variável HANDBACK_CONTATO). */
export function contato(): string {
  return process.env.HANDBACK_CONTATO?.trim() || "";
}

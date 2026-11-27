import type { Metadata } from "next";
import Link from "next/link";
import { Marca } from "@/components/marca";
import { contato, Rodape } from "@/components/rodape";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Quais cookies o Handback usa e para quê.",
};

const COOKIES = [
  { nome: "Sessão de login (Supabase)", para: "Manter você conectado à sua conta.", quanto: "Enquanto você estiver conectado", tipo: "Necessário" },
  { nome: "hb_turma_…", para: "Lembrar a turma que você escolheu no menu.", quanto: "1 ano", tipo: "Preferência" },
  { nome: "hb_tema", para: "Lembrar se você prefere o tema claro ou escuro.", quanto: "1 ano", tipo: "Preferência" },
  { nome: "hb_aviso_cookies", para: "Lembrar que você já viu o aviso de cookies.", quanto: "1 ano", tipo: "Necessário" },
] as const;

export default function Cookies() {
  const email = contato();
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Marca />
        <Link href="/" className="text-sm font-medium text-marca-forte hover:underline">
          Início
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pb-16 pt-6 leading-relaxed sm:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Cookies</h1>
          <p className="text-sm text-suave">Atualizado em 27 de novembro de 2026</p>
        </div>
        <p>
          Cookies são pequenos arquivos que o site guarda no seu aparelho. O Handback usa <strong>só os necessários</strong> para funcionar e
          para lembrar as suas escolhas. <strong>Não usamos cookies de anúncio, de rastreamento nem de análise de visitas.</strong> Por isso o
          aviso só informa, sem pedir que você escolha.
        </p>
        <ul className="flex flex-col gap-3">
          {COOKIES.map((c) => (
            <li key={c.nome} className="flex flex-col gap-1 rounded-2xl border border-borda bg-cartao p-4">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <b className="break-all">{c.nome}</b>
                <span className="rounded-full bg-marca-clara px-2.5 py-0.5 text-xs font-bold text-marca-forte">{c.tipo}</span>
              </span>
              <span className="text-sm text-suave">{c.para}</span>
              <span className="text-xs text-suave">Dura: {c.quanto}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-suave">
          O app também guarda no próprio aparelho (não é cookie) quais menus você deixou abertos e quais avisos você já fechou. Isso não sai do
          seu aparelho. Você pode apagar tudo nas configurações do navegador, mas então precisará entrar de novo.
        </p>
        <p className="text-sm text-suave">
          Veja também a{" "}
          <Link href="/privacidade" className="font-medium text-marca-forte underline">
            Política de privacidade
          </Link>
          .{email ? ` Dúvidas: ${email}.` : ""}
        </p>
      </main>
      <Rodape />
    </div>
  );
}

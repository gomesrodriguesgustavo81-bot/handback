import Link from "next/link";
import { Aviso, Selo } from "@/components/ui";
import { FRENTES, PAPEIS } from "@/lib/frentes";
import { contextoDaEmpresa } from "@/lib/empresa";
import { AbasEmpresa } from "./abas";
import { completarVocabulario, quemEntrega } from "@/lib/nomes";
import { turmaAtual, turmasDaEmpresa } from "@/lib/turma";
import { escolherTurma } from "./turma-acoes";
import { SoForaDaFolha } from "./so-fora-da-folha";

export default async function LayoutEmpresa({
  children,
  params,
}: LayoutProps<"/app/[slug]">) {
  const { slug } = await params;
  const { empresa, podeGerir, podeAvaliar } = await contextoDaEmpresa(slug);
  const v = completarVocabulario(empresa.vocabulario);
  const [turmas, atual] = await Promise.all([
    turmasDaEmpresa(empresa.id),
    turmaAtual(empresa.id),
  ]);
  const ativas = turmas.filter((t) => !t.arquivada);
  const entrega = quemEntrega(v, atual?.modo ?? "grupos");

  const abas = [
    { href: `/app/${slug}`, nome: "Visão geral", exato: true },
    ...(podeAvaliar
      ? [{ href: `/app/${slug}/entregas`, nome: "Entregas" }]
      : []),
    { href: `/app/${slug}/etapas`, nome: v.etapas },
    ...(podeAvaliar
      ? [{ href: `/app/${slug}/grupos`, nome: entrega.varios }]
      : []),
    ...(podeGerir
      ? [
          { href: `/app/${slug}/pessoas`, nome: "Usuários" },
          { href: `/app/${slug}/ajustes`, nome: "Ajustes" },
          { href: `/app/${slug}/registro`, nome: "Registro" },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{empresa.nome}</h1>
          <Selo>{FRENTES[empresa.frente].curto}</Selo>
        </div>
        <p className="text-sm text-suave">
          Seu papel:{" "}
          {empresa.papel ? PAPEIS[empresa.papel] : "Dono da plataforma"}
        </p>
      </div>
      {!empresa.ativa ? (
        <Aviso tipo="alerta">
          Esta empresa está bloqueada. Fale com o suporte do Handback.
        </Aviso>
      ) : null}
      {ativas.length > 1 || podeGerir ? (
        <SoForaDaFolha>
          <nav
            aria-label={v.espaco}
            className="-mx-4 overflow-x-auto px-4 print:hidden sm:mx-0 sm:px-0"
          >
            <ul className="flex min-w-max items-center gap-1.5">
              {ativas.map((t) => (
                <li key={t.id}>
                  <form action={escolherTurma.bind(null, slug, t.id)}>
                    <button
                      type="submit"
                      aria-current={t.id === atual?.id ? "true" : undefined}
                      className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-semibold ${
                        t.id === atual?.id
                          ? "border-texto bg-texto text-fundo"
                          : "border-borda bg-cartao text-suave hover:text-texto"
                      }`}
                    >
                      {t.nome}
                    </button>
                  </form>
                </li>
              ))}
              {podeGerir ? (
                <li>
                  <Link
                    href={`/app/${slug}/ajustes#turmas`}
                    className="inline-flex min-h-9 items-center rounded-full border border-dashed border-borda px-3 text-[13px] font-semibold text-suave hover:text-texto"
                  >
                    + {v.espaco}
                  </Link>
                </li>
              ) : null}
            </ul>
          </nav>
        </SoForaDaFolha>
      ) : null}
      <AbasEmpresa abas={abas} />
      {children}
    </div>
  );
}

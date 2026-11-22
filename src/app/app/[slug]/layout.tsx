import { Aviso, Selo } from "@/components/ui";
import { FRENTES } from "@/lib/frentes";
import { contextoDaEmpresa } from "@/lib/empresa";
import { AbasEmpresa } from "./abas";

export default async function LayoutEmpresa({ children, params }: LayoutProps<"/app/[slug]">) {
  const { slug } = await params;
  const { empresa, podeGerir, podeAvaliar, souIntegrante, descricaoDoPapel } = await contextoDaEmpresa(slug);
  const v = empresa.vocabulario;

  const abas = [
    { href: `/app/${slug}`, nome: "Visão geral", exato: true },
    ...(souIntegrante ? [{ href: `/app/${slug}/entregar`, nome: "Entregar" }] : []),
    ...(podeAvaliar ? [{ href: `/app/${slug}/entregas`, nome: "Entregas" }] : []),
    { href: `/app/${slug}/etapas`, nome: v.etapas },
    ...(podeAvaliar ? [{ href: `/app/${slug}/grupos`, nome: v.grupos }] : []),
    ...(podeGerir
      ? [
          { href: `/app/${slug}/pessoas`, nome: "Pessoas" },
          { href: `/app/${slug}/ajustes`, nome: "Ajustes" },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{empresa.nome}</h1>
          <Selo>{FRENTES[empresa.frente].curto}</Selo>
        </div>
        <p className="text-sm text-suave">
          Seu papel: {descricaoDoPapel}
        </p>
      </div>
      {!empresa.ativa ? (
        <Aviso tipo="alerta">Esta empresa está bloqueada. Fale com o suporte do Handback.</Aviso>
      ) : null}
      <AbasEmpresa abas={abas} />
      {children}
    </div>
  );
}

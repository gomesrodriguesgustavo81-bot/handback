import { Aviso } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { AbasEmpresa } from "./abas";
import { completarVocabulario, quemEntrega } from "@/lib/nomes";
import { turmaAtual, turmasDaEmpresa } from "@/lib/turma";
import { SeletorTurma } from "./seletor-turma";
import { SoForaDaFolha } from "./so-fora-da-folha";

/**
 * Moldura de cada empresa: a turma escolhida, as 3 abas do dia a dia
 * (Entregas, etapas e quem entrega) e, para quem administra, a engrenagem
 * das Configurações (o que vale para a conta inteira).
 */
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
    ...(podeAvaliar
      ? [{ href: `/app/${slug}/entregas`, nome: "Entregas" }]
      : []),
    { href: `/app/${slug}/etapas`, nome: v.etapas },
    ...(podeAvaliar
      ? [{ href: `/app/${slug}/grupos`, nome: entrega.varios }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {!empresa.ativa ? (
        <Aviso tipo="alerta">
          Esta empresa está bloqueada. Fale com o suporte do Handback.
        </Aviso>
      ) : null}
      {ativas.length > 1 || podeGerir ? (
        <SoForaDaFolha>
          <SeletorTurma
            slug={slug}
            rotulo={v.espaco}
            turmas={ativas.map((t) => ({ id: t.id, nome: t.moodle_conta ? `${t.nome} (Moodle)` : t.nome }))}
            atual={atual?.id ?? null}
            criarHref={podeGerir ? `/app/${slug}/ajustes#turmas` : null}
          />
        </SoForaDaFolha>
      ) : null}
      <AbasEmpresa
        abas={abas}
        configuracoes={podeGerir ? `/app/${slug}/configuracoes` : null}
        paginasDeConfiguracao={
          podeGerir
            ? ["ajustes", "pessoas", "registro", "moodle"].map((p) => `/app/${slug}/${p}`)
            : []
        }
      />
      {children}
    </div>
  );
}

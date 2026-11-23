import Link from "next/link";
import { Aviso } from "@/components/ui";
import { sairDoSuporte } from "@/app/admin/actions";
import { acessoAtivo } from "@/lib/suporte";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { contextoDaEmpresa } from "@/lib/empresa";
import { AbasEmpresa } from "./abas";
import { completarVocabulario, o, quemEntrega } from "@/lib/nomes";
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
  const acesso = await acessoAtivo(await criarClienteServidor(), empresa.id);
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
          Est{o(v, "organizacao")} {v.organizacao.toLowerCase()} está bloquead{o(v, "organizacao")}. Fale com o suporte do Handback.
        </Aviso>
      ) : null}
      {acesso && empresa.papel === null ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-acento px-4 py-3 text-sm text-sobre-acento">
          <span>
            <strong>Modo {acesso.tipo === "emergencia" ? "emergência" : "suporte"}</strong> até {dataHoraBR(acesso.fim)}. Tudo o que você abrir fica no registro
            deste espaço.
          </span>
          <form action={sairDoSuporte.bind(null, empresa.id)}>
            <button type="submit" className="min-h-10 rounded-full bg-sobre-acento px-4 font-semibold text-acento">
              Sair do suporte
            </button>
          </form>
        </div>
      ) : acesso ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-acento bg-cartao px-4 py-3 text-sm">
          <span>
            {acesso.tipo === "emergencia" ? (
              <>
                <strong>Acesso de emergência do Handback</strong> até {dataHoraBR(acesso.fim)}. Motivo: {acesso.motivo}
              </>
            ) : (
              <>
                <strong>O suporte do Handback tem acesso</strong> a este espaço até {dataHoraBR(acesso.fim)}.
              </>
            )}
          </span>
          {empresa.papel === "admin" ? (
            <Link href={`/app/${slug}/configuracoes/seguranca`} className="font-semibold text-marca-forte underline">
              Ver ou cortar
            </Link>
          ) : null}
        </div>
      ) : null}
      <div className="contents print:hidden">
      {ativas.length > 1 || podeGerir ? (
        <SoForaDaFolha>
          <SeletorTurma
            slug={slug}
            rotulo={v.espaco}
            turmas={ativas.map((t) => ({ id: t.id, nome: t.moodle_conta ? `${t.nome} (Moodle)` : t.nome }))}
            atual={atual?.id ?? null}
            criarHref={podeGerir ? `/app/${slug}/configuracoes/turmas` : null}
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
      </div>
      {children}
    </div>
  );
}

import Link from "next/link";
import { FormConfirmado } from "@/components/confirmar";
import { Aviso } from "@/components/ui";
import { sairDoSuporte } from "@/app/admin/actions";
import { acessoAtivo } from "@/lib/suporte";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { contextoDaEmpresa } from "@/lib/empresa";
import { Navegacao, VoltarConfiguracoes, type ItemNav } from "./navegacao";
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

  const abas: ItemNav[] = [
    ...(podeAvaliar ? [{ href: `/app/${slug}/entregas`, nome: "Entregas", icone: "entregas" as const }] : []),
    { href: `/app/${slug}/etapas`, nome: v.etapas, icone: "aulas" },
    { href: `/app/${slug}/calendario`, nome: "Calendário", icone: "calendario" },
    ...(podeAvaliar ? [{ href: `/app/${slug}/grupos`, nome: entrega.varios, icone: "equipes" as const }] : []),
  ];
  const mais: ItemNav[] = [
    ...(podeAvaliar ? [{ href: `/app/${slug}/relatorios`, nome: "Relatórios", icone: "relatorios" as const }] : []),
    ...(podeGerir ? [{ href: `/app/${slug}/moodle`, nome: "Moodle", icone: "moodle" as const }] : []),
    ...(podeGerir ? [{ href: `/app/${slug}/configuracoes/drive`, nome: "Google Drive", icone: "drive" as const }] : []),
  ];
  const configuracoes = podeGerir ? `/app/${slug}/configuracoes` : null;
  const paginasDeConfiguracao = podeGerir ? ["ajustes", "pessoas", "registro"].map((p) => `/app/${slug}/${p}`) : [];

  return (
    <div className="flex flex-col gap-4 pb-20 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-8 lg:pb-0 print:block print:pb-0">
      <Navegacao abas={abas} mais={mais} configuracoes={configuracoes} paginasDeConfiguracao={paginasDeConfiguracao} />
      <div className="flex min-w-0 flex-col gap-4">
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
          <FormConfirmado action={sairDoSuporte.bind(null, empresa.id)} pergunta={{ titulo: "Sair do suporte agora?", texto: "Você deixa de ver o conteúdo deste espaço.", sim: "Sim, sair" }}>
            <button type="submit" className="min-h-10 rounded-full bg-sobre-acento px-4 font-semibold text-acento">
              Sair do suporte
            </button>
          </FormConfirmado>
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
      {configuracoes ? <VoltarConfiguracoes configuracoes={configuracoes} paginasDeConfiguracao={paginasDeConfiguracao} /> : null}
      </div>
      {children}
      </div>
    </div>
  );
}

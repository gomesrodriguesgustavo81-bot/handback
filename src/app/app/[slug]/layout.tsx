import Link from "next/link";
import { FormConfirmado } from "@/components/confirmar";
import { Aviso } from "@/components/ui";
import { sairDoSuporte } from "@/app/admin/actions";
import { acessoAtivo } from "@/lib/suporte";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { contextoCoordenacao } from "@/lib/empresa";
import { Navegacao, Voltar, type GrupoNav, type ItemNav, type Volta } from "./navegacao";
import { completarVocabulario, o, quemEntrega } from "@/lib/nomes";
import { turmaAtual, turmasDaEmpresa } from "@/lib/turma";
import { SeletorTurma } from "./seletor-turma";
import { SoForaDaFolha } from "./so-fora-da-folha";
import { Saudacao } from "@/components/saudacao";
import { usuarioAtual } from "@/lib/sessao";

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
  const [{ empresa, podeGerir, podeAvaliar, ehCoordenacao }, eu] = await Promise.all([contextoCoordenacao(slug), usuarioAtual()]);
  const v = completarVocabulario(empresa.vocabulario);
  // Coordenação não lê as turmas direto (só os números, pela própria tela dela).
  const [turmas, atual] = ehCoordenacao ? [[], null] : await Promise.all([turmasDaEmpresa(empresa.id), turmaAtual(empresa.id)]);
  const ativas = turmas.filter((t) => !t.arquivada);
  const acesso = await acessoAtivo(await criarClienteServidor(), empresa.id);
  const entrega = quemEntrega(v, atual?.modo ?? "grupos");

  const b = `/app/${slug}`;
  const inicio: ItemNav = { href: `${b}/inicio`, nome: "Início", icone: "inicio" };
  const ciclos: ItemNav = { href: `${b}/etapas`, nome: v.etapas, icone: "aulas" };
  const alunos: ItemNav = { href: `${b}/grupos`, nome: entrega.varios, icone: "equipes" };
  const ajustesTurma = ["drive", "agenda", "lembretes", "recebimento"].map((p) => `${b}/configuracoes/${p}`);
  const calendario: ItemNav = { href: `${b}/calendario`, nome: "Calendário", icone: "calendario" };
  // Entregas não é mais uma aba: as entregas ficam dentro de cada ciclo (a aba Ciclos acende nelas).
  ciclos.tambem = [`${b}/entregas`];
  const coordenacao: ItemNav = { href: `${b}/coordenacao`, nome: "Coordenação", icone: "relatorios" };
  const abas: ItemNav[] = ehCoordenacao ? [coordenacao] : podeAvaliar ? [inicio, ciclos, alunos, calendario] : [ciclos, calendario];
  const grupos: GrupoNav[] = [
    { nome: "", itens: ehCoordenacao ? [coordenacao] : podeAvaliar ? [inicio, ciclos, alunos, calendario] : [ciclos, calendario] },
    {
      nome: "",
      pequeno: true,
      itens: [
        ...(podeAvaliar && !ehCoordenacao ? [{ href: `${b}/relatorios`, nome: "Relatórios", icone: "relatorios" as const }] : []),
        ...(podeGerir ? [{ href: `${b}/turma`, nome: `Ajustes d${o(v, "espaco")} ${v.espaco.toLowerCase()}`, icone: "ajustes" as const, tambem: ajustesTurma }] : []),
        ...(podeGerir
          ? [
              { href: `${b}/contas`, nome: "Contas conectadas", icone: "contas" as const },
              {
                href: `${b}/configuracoes`,
                nome: "Configurações",
                icone: "config" as const,
                tambem: ["pessoas", "registro", "ajustes", "nova-turma", "moodle"].map((p) => `${b}/${p}`),
              },
            ]
          : []),
      ],
    },
  ].filter((g) => g.itens.length);
  const voltas: Volta[] = podeGerir
    ? [
        { href: `${b}/turma`, nome: `Ajustes d${o(v, "espaco")} ${v.espaco.toLowerCase()}`, prefixos: ajustesTurma },
        { href: `${b}/nova-turma`, nome: `Nov${o(v, "espaco")} ${v.espaco.toLowerCase()}`, prefixos: [`${b}/moodle`, `${b}/configuracoes/classroom`] },
        { href: `${b}/configuracoes`, nome: "Configurações", prefixos: [`${b}/configuracoes`, `${b}/pessoas`, `${b}/registro`, `${b}/nova-turma`] },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4 pb-28 lg:grid lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:gap-8 lg:pb-0 print:block print:pb-0">
      {/* No computador, a turma fica no alto do menu do lado; no celular, no alto da página. */}
      <div className="contents lg:sticky lg:top-6 lg:flex lg:flex-col lg:gap-3 lg:self-start print:hidden">
        {ativas.length > 1 || podeGerir ? (
          <SoForaDaFolha foraDoInicio>
            <div className="turma-no-menu lg:w-56">
              <SeletorTurma
                slug={slug}
                rotulo={v.espaco}
                turmas={ativas.map((t) => ({ id: t.id, nome: t.moodle_conta ? `${t.nome} (Moodle)` : t.classroom_curso ? `${t.nome} (Classroom)` : t.nome }))}
                atual={atual?.id ?? null}
                criarHref={podeGerir ? `/app/${slug}/nova-turma` : null}
              />
            </div>
          </SoForaDaFolha>
        ) : null}
        <Navegacao abas={abas} grupos={grupos} />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
      <SoForaDaFolha>
        <Saudacao nome={eu.nome} email={eu.email} />
      </SoForaDaFolha>
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
      <Voltar voltas={voltas} />
      </div>
      {children}
      </div>
    </div>
  );
}

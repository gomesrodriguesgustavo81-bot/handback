import Link from "next/link";
import { completarVocabulario, generoDe, plural } from "@/lib/nomes";
import type { MinhaEmpresa } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";

type Passo = { titulo: string; texto: string; href: string; feito: boolean };

/** O que falta para o Handback funcionar e ficar do jeito da pessoa (some quando tudo estiver feito). */
export async function passosDoComeco(slug: string, empresa: MinhaEmpresa): Promise<Passo[]> {
  const vc = completarVocabulario(empresa.vocabulario);
  const supabase = await criarClienteServidor();
  const turma = await turmaAtual(empresa.id);
  const tId = turma?.id ?? "";
  const [{ data: eu }, { count: aulas }, { count: equipes }, { data: t }, { data: gmail }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("etapas").select("id", { count: "exact", head: true }).eq("turma_id", tId),
    supabase.from("grupos").select("id", { count: "exact", head: true }).eq("turma_id", tId).eq("escondido", false),
    supabase.from("turmas").select("mensagem_copiada_em, moodle_conta, classroom_curso").eq("id", tId).maybeSingle(),
    supabase.from("contas_gmail").select("invalida").maybeSingle(),
  ]);
  const base = `/app/${slug}`;
  const etapa = vc.etapa.toLowerCase();
  const umaEquipe = turma?.modo === "individual" ? vc.pessoa : vc.grupo;
  return [
    {
      titulo: "Seu nome nos e-mails",
      texto: "É o nome que os alunos veem nas devolutivas e nos lembretes",
      href: `${base}/configuracoes/email`,
      feito: Boolean(String(eu.user?.user_metadata?.nome ?? "").trim()),
    },
    {
      titulo: "Nomes do seu jeito",
      texto: `${vc.etapa}, ${vc.grupo}… como você chama as coisas`,
      href: `${base}/configuracoes/nomes`,
      feito: empresa.configurada,
    },
    {
      titulo: `${generoDe(vc.etapa) === "f" ? "Primeira" : "Primeiro"} ${etapa}`,
      texto: "Prazo e o que deve ser entregue",
      href: `${base}/etapas/nova`,
      feito: (aulas ?? 0) > 0,
    },
    {
      titulo: `${plural(umaEquipe)} e alunos`,
      texto: "Cadastre à mão, cole uma lista ou traga do Moodle ou do Classroom",
      href: `${base}/grupos`,
      feito: (equipes ?? 0) > 0 || Boolean(t?.moodle_conta) || Boolean(t?.classroom_curso),
    },
    {
      titulo: "Mandar a mensagem para a turma",
      texto: "Copie a mensagem pronta com o endereço de entrega",
      href: `${base}/configuracoes/recebimento`,
      feito: Boolean(t?.mensagem_copiada_em) || Boolean(t?.moodle_conta) || Boolean(t?.classroom_curso),
    },
    {
      titulo: "Conectar seu Gmail",
      texto: "Para as devolutivas saírem do seu e-mail",
      href: `${base}/contas`,
      feito: Boolean(gmail && !gmail.invalida),
    },
  ];
}

/** Lista completa (no topo das Configurações). */
export function PrimeirosPassos({ passos }: { passos: Passo[] }) {
  const feitos = passos.filter((p) => p.feito).length;
  if (feitos === passos.length) return null;
  return (
    <section aria-label="Primeiros passos" className="entra flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Primeiros passos</h2>
        <span className="text-sm font-bold text-marca-forte">
          {feitos} de {passos.length}
        </span>
      </div>
      <span aria-hidden className="block h-2 overflow-hidden rounded-full bg-fundo">
        <span className="block h-full rounded-full bg-marca transition-all" style={{ width: `${Math.round((feitos / passos.length) * 100)}%` }} />
      </span>
      <ol className="flex flex-col">
        {passos.map((p, i) => (
          <li key={p.titulo} className="border-t border-borda first:border-t-0">
            <Link href={p.href} className="flex min-h-14 items-center gap-3 py-2 hover:text-marca-forte">
              <span
                aria-hidden
                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${p.feito ? "bg-acento text-sobre-acento" : "bg-fundo text-suave"}`}
              >
                {p.feito ? "✓" : i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`font-semibold ${p.feito ? "text-suave line-through" : ""}`}>
                  {p.titulo}
                  <span className="sr-only">{p.feito ? " (feito)" : " (falta)"}</span>
                </span>
                <span className="text-xs text-suave">{p.texto}</span>
              </span>
              <span aria-hidden className="text-suave">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ol>
      <p className="text-xs text-suave">A lista some sozinha quando tudo estiver feito.</p>
    </section>
  );
}

/** Lembrete curto (no topo das Entregas) enquanto faltar algum passo. */
export function FaltamPassos({ slug, passos }: { slug: string; passos: Passo[] }) {
  const faltam = passos.filter((p) => !p.feito).length;
  if (!faltam) return null;
  return (
    <Link
      href={`/app/${slug}/configuracoes`}
      className="flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-marca-clara px-4 py-2 text-sm font-semibold text-marca-forte hover:underline"
    >
      <span>
        {faltam === 1 ? "Falta 1 passo" : `Faltam ${faltam} passos`} para o Handback ficar pronto
      </span>
      <span aria-hidden>›</span>
    </Link>
  );
}

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { turmaAtual } from "@/lib/turma";
import Link from "next/link";
import { Cartao } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataBR, hojeISO, minusc } from "@/lib/textos";

export async function generateMetadata({ params }: PageProps<"/app/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { empresa } = await contextoDaEmpresa(slug);
  return { title: empresa.nome };
}

export default async function VisaoGeral({ params }: PageProps<"/app/[slug]">) {
  const { slug } = await params;
  const { empresa, podeAvaliar, podeGerir } = await contextoDaEmpresa(slug);
  // Conta nova: o administrador passa pelo primeiro acesso guiado.
  if (!empresa.configurada && podeGerir) redirect(`/app/${slug}/comecar`);
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();

  const hoje = hojeISO();
  const turma = await turmaAtual(empresa.id);
  const tId = turma?.id ?? "";
  const [etapas, grupos, proxima] = await Promise.all([
    supabase.from("etapas").select("id", { count: "exact", head: true }).eq("org_id", empresa.id).eq("turma_id", tId),
    podeAvaliar
      ? supabase.from("grupos").select("id", { count: "exact", head: true }).eq("org_id", empresa.id).eq("turma_id", tId).eq("ativo", true)
      : Promise.resolve({ count: null }),
    supabase
      .from("etapas")
      .select("id, numero, titulo, recebe_ate")
      .eq("org_id", empresa.id)
      .eq("turma_id", tId)
      .gte("recebe_ate", hoje)
      .order("recebe_ate")
      .limit(1)
      .maybeSingle(),
  ]);

  const numeros = [
    { nome: v.etapas, valor: etapas.count ?? 0, href: `/app/${slug}/etapas` },
    ...(podeAvaliar ? [{ nome: v.grupos, valor: grupos.count ?? 0, href: `/app/${slug}/grupos` }] : []),
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {numeros.map((n) => (
          <Link key={n.nome} href={n.href} className="rounded-2xl border border-borda bg-cartao p-4 hover:border-marca">
            <p className="text-3xl font-semibold">{n.valor}</p>
            <p className="text-sm text-suave">{n.nome}</p>
          </Link>
        ))}
      </div>

      <Cartao>
        <h2 className="font-semibold">Próximo prazo de entrega</h2>
        {proxima.data ? (
          <p className="mt-1">
            <Link href={`/app/${slug}/etapas/${proxima.data.id}`} className="font-medium text-marca-forte hover:underline">
              {v.etapa} {proxima.data.numero} · {proxima.data.titulo}
            </Link>{" "}
            <span className="text-suave">— até {dataBR(proxima.data.recebe_ate)}</span>
          </p>
        ) : (
          <p className="mt-1 text-suave">
            Nenhum prazo pela frente. Os prazos aparecem aqui quando houver {minusc(v.etapas)} com data de recebimento.
          </p>
        )}
      </Cartao>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Em construção</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li className="rounded-2xl border border-dashed border-borda p-5">
            <p className="font-medium">Análise com IA</p>
            <p className="mt-1 text-sm text-suave">Checklist item a item, conceito sugerido e análise interna de cada entrega.</p>
          </li>
          <li className="rounded-2xl border border-dashed border-borda p-5">
            <p className="font-medium">Devolutivas</p>
            <p className="mt-1 text-sm text-suave">
              Análise com IA, revisão do {minusc(v.avaliador)} e envio.
            </p>
          </li>
        </ul>
      </section>
    </>
  );
}

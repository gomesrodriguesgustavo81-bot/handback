import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CampoAuto } from "@/components/campo-auto";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Segurança" };

export default async function Seguranca({ params }: PageProps<"/app/[slug]/configuracoes/seguranca">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const supabase = await criarClienteServidor();
  const { data: c } = await supabase.from("organizacoes").select("exigir_duas_etapas").eq("id", empresa.id).single();
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Segurança</h1>
        <p className="text-sm text-suave">Com a verificação em duas etapas, quem descobrir a senha de alguém ainda não consegue entrar.</p>
      </div>
      <div className="rounded-2xl border border-borda bg-cartao p-4">
        <CampoAuto
          slug={slug}
          campo="exigir_duas_etapas"
          rotulo="Verificação em duas etapas (senha + código do celular)"
          tipo="escolha"
          valor={c?.exigir_duas_etapas === false ? "nao" : "sim"}
          opcoes={[
            { valor: "sim", nome: "Obrigatória para todos (recomendado)" },
            { valor: "nao", nome: "Opcional (cada pessoa decide)" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2 text-sm">
        <Link href={`/app/${slug}/registro`} className="font-medium text-marca-forte hover:underline">
          Ver o registro de atividades →
        </Link>
        <Link href="/conta" className="font-medium text-marca-forte hover:underline">
          Minha senha e meu celular →
        </Link>
      </div>
    </div>
  );
}

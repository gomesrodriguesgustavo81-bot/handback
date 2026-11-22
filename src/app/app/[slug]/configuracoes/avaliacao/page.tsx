import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CampoAuto } from "@/components/campo-auto";
import { contextoDaEmpresa } from "@/lib/empresa";
import { ROTULO_REGRA, type RegraChecklist } from "@/lib/ia/regras";
import { criarClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Conceitos e IA" };

const RESUMO: Record<string, string> = { EXCELENTE: "tudo e com qualidade", BOM: "tudo, com ajustes", REGULAR: "faltou parte", RUIM: "quase nada" };

export default async function Avaliacao({ params }: PageProps<"/app/[slug]/configuracoes/avaliacao">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const supabase = await criarClienteServidor();
  const { data: c } = await supabase
    .from("organizacoes")
    .select("conceitos, regra_checklist, exemplos_devolutiva, enviar_conceito")
    .eq("id", empresa.id)
    .single();
  const conceitos = (c?.conceitos ?? {}) as Record<string, string>;
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Conceitos e IA</h1>
        <p className="text-sm text-suave">A IA usa estas descrições para sugerir o conceito. Sem notas: só os quatro conceitos. Tudo salva sozinho.</p>
      </div>
      {(["EXCELENTE", "BOM", "REGULAR", "RUIM"] as const).map((k, i) => (
        <details key={k} open={i === 0} className="group rounded-2xl border border-borda bg-cartao">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-2 px-4 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-marca-clara px-2.5 py-0.5 text-xs font-bold text-marca-forte">{k}</span>
              <span className="text-sm text-suave">{RESUMO[k]}</span>
            </span>
            <span aria-hidden className="text-lg text-suave transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="px-4 pb-4">
            <CampoAuto slug={slug} campo={`conceito_${k}`} rotulo={`O que é ${k}`} valor={conceitos[k] ?? ""} tipo="area" maximo={1000} />
          </div>
        </details>
      ))}
      <div className="flex flex-col gap-4 rounded-2xl border border-borda bg-cartao p-4">
        <CampoAuto
          slug={slug}
          campo="regra_checklist"
          rotulo="Regra do checklist"
          tipo="escolha"
          valor={c?.regra_checklist ?? "flexivel"}
          opcoes={(Object.keys(ROTULO_REGRA) as RegraChecklist[]).map((r) => ({ valor: r, nome: ROTULO_REGRA[r] }))}
          dica="Uma observação na etapa que cite um conceito (ex.: “se faltar X, no máximo REGULAR”) sempre tem prioridade."
        />
        <CampoAuto
          slug={slug}
          campo="enviar_conceito"
          rotulo="Na devolutiva enviada"
          tipo="escolha"
          valor={c?.enviar_conceito === false ? "nao" : "sim"}
          opcoes={[
            { valor: "sim", nome: "Mandar o conceito e o checklist junto com o texto" },
            { valor: "nao", nome: "Mandar só o texto" },
          ]}
        />
        <CampoAuto
          slug={slug}
          campo="exemplos_devolutiva"
          rotulo="Exemplos de devolutivas (opcional)"
          tipo="area"
          linhas={6}
          maximo={20000}
          valor={c?.exemplos_devolutiva ?? ""}
          dica="A IA imita o tom e o tamanho destes exemplos. Separe um do outro com uma linha só com ---. Vazio: ela usa as últimas devolutivas aprovadas aqui."
        />
      </div>
    </div>
  );
}

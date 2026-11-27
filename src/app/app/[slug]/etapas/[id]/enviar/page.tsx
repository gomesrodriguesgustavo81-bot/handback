import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { meuGmail } from "@/lib/envio";
import { gmailConfigurado } from "@/lib/gmail";
import { criarClienteServidor } from "@/lib/supabase/server";
import { trilhasDaTurma } from "@/lib/trilha-dados";
import { EnviarTudo, type Caminho } from "./enviar-tudo";

export const metadata: Metadata = { title: "Enviar" };
export const maxDuration = 300;

const CONCEITOS = ["EXCELENTE", "BOM", "REGULAR", "RUIM"] as const;
const NOME_CONCEITO: Record<string, string> = { EXCELENTE: "Excelente", BOM: "Bom", REGULAR: "Regular", RUIM: "Ruim" };

/** Passo 5 do ciclo: tudo o que foi aprovado sai de uma vez, pelos caminhos da turma. */
export default async function EnviarCiclo({ params }: PageProps<"/app/[slug]/etapas/[id]/enviar">) {
  const { slug, id } = await params;
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();
  const { data: etapa } = await supabase
    .from("etapas")
    .select("id, numero, titulo, entregaveis, recebe_ate, turma_id, classroom_tarefa, classroom_nosso, moodle_tarefa")
    .eq("org_id", empresa.id)
    .eq("id", id)
    .maybeSingle();
  if (!etapa) notFound();
  const { data: turma } = await supabase.from("turmas").select("id, classroom_curso").eq("id", etapa.turma_id).maybeSingle();
  if (!turma) notFound();
  const [dados, gmail] = await Promise.all([trilhasDaTurma(supabase, empresa.id, turma, [etapa]).then((m) => m.get(etapa.id)), meuGmail(supabase)]);
  const paraEnviar = dados?.paraEnviar ?? [];
  const { data: analises } = paraEnviar.length
    ? await supabase.from("analises").select("conceito").in("entrega_id", paraEnviar.map((e) => e.id))
    : { data: [] as { conceito: string | null }[] };
  const porConceito = CONCEITOS.map((c) => [c, (analises ?? []).filter((a) => a.conceito === c).length] as const).filter(([, n]) => n);

  const gmailOk = Boolean(gmail && !gmail.invalida);
  const caminhos: Caminho[] = [];
  if (turma.classroom_curso && etapa.classroom_tarefa)
    caminhos.push({
      id: "classroom",
      nome: "Google Classroom",
      detalhe: "A nota é lançada e o trabalho volta para o aluno.",
      pode: Boolean(etapa.classroom_nosso),
      porque: "Esta tarefa foi criada direto no Classroom: o Google não deixa o Handback lançar a nota nela.",
    });
  if (etapa.moodle_tarefa) caminhos.push({ id: "moodle", nome: "Moodle", detalhe: "Comentário na tarefa, com a nota do conceito.", pode: true });
  if (gmailConfigurado())
    caminhos.push({
      id: "email",
      nome: "E-mail do aluno",
      detalhe: `A devolutiva escrita, do seu Gmail${gmail ? ` (${gmail.email})` : ""}.`,
      pode: gmailOk,
      porque: gmail?.invalida ? "A conexão com o Gmail expirou. Conecte de novo em Contas conectadas." : "Conecte seu Gmail em Contas conectadas para mandar por e-mail.",
    });
  const voltar = `/app/${slug}/etapas/${etapa.id}`;
  const conectarHref = `/api/gmail/conectar?voltar=${encodeURIComponent(`${voltar}/enviar`)}`;
  const naoEntregaram = dados ? Math.max(0, dados.contagem.total - dados.contagem.entregaram) : 0;

  return (
    <section className="flex max-w-xl flex-col gap-4">
      <Link href={voltar} transitionTypes={["nav-back"]} className="self-start text-sm text-suave hover:text-texto">
        ← {v.etapa} {etapa.numero} · {etapa.titulo}
      </Link>
      {paraEnviar.length ? (
        <>
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <span aria-hidden className="flex size-16 items-center justify-center rounded-[20px] bg-ok-fundo text-ok">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l4 4 10-10" />
              </svg>
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">{dados?.contagem.revisar ? "Prontas para sair" : "Tudo revisado!"}</h1>
            <p className="text-sm text-suave">
              {paraEnviar.length === 1 ? "1 devolutiva aprovada e pronta para sair." : `${paraEnviar.length} devolutivas aprovadas e prontas para sair.`}
              {dados?.contagem.revisar ? ` Ainda faltam ${dados.contagem.revisar} para revisar.` : ""}
            </p>
          </div>
          {porConceito.length ? (
            <p className="flex flex-wrap justify-between gap-2 rounded-2xl border border-borda bg-cartao px-4 py-3 text-sm">
              {porConceito.map(([c, n]) => (
                <span key={c}>
                  {NOME_CONCEITO[c]} <b>{n}</b>
                </span>
              ))}
            </p>
          ) : null}
          {naoEntregaram ? <p className="text-center text-[13px] text-suave">{naoEntregaram === 1 ? "1 não entregou e não recebe nada agora." : `${naoEntregaram} não entregaram e não recebem nada agora.`}</p> : null}
          <EnviarTudo slug={slug} entregas={paraEnviar} caminhos={caminhos} conectarHref={conectarHref} voltar={voltar} />
        </>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-6 text-center">
          <h1 className="text-xl font-extrabold">Nada para enviar agora</h1>
          <p className="text-sm text-suave">Quando você aprovar devolutivas, elas aparecem aqui para sair de uma vez.</p>
          <Link href={voltar} className="font-semibold text-marca-forte hover:underline">
            Voltar para a entrega
          </Link>
        </div>
      )}
    </section>
  );
}

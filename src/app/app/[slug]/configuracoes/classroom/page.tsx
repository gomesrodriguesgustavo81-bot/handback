import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContaNecessaria } from "@/components/conta-necessaria";
import { Aviso } from "@/components/ui";
import { ErroClassroom, meusCursos } from "@/lib/classroom/cliente";
import { acessoDoClassroom } from "@/lib/classroom/sincronizar";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario, o } from "@/lib/nomes";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { EscolherTurma } from "./painel";

export const metadata: Metadata = { title: "Nova turma do Google Classroom" };
export const maxDuration = 60;

/** Nova turma a partir de uma sala do Classroom (cada sala vira uma turma própria). */
export default async function Classroom({ params }: PageProps<"/app/[slug]/configuracoes/classroom">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const vc = completarVocabulario(empresa.vocabulario);
  const supabase = await criarClienteServidor();
  const [{ data: eu }, { data: con }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("conexoes_google").select("email, invalida").eq("servico", "classroom").maybeSingle(),
  ]);
  const meuId = eu.user?.id ?? "";
  const conectado = con && !con.invalida ? con : null;
  const { data: ligadas } = await supabase.from("turmas").select("id, nome, classroom_curso").eq("org_id", empresa.id).eq("classroom_por", meuId).not("classroom_curso", "is", null);
  const jaLigadas = new Set((ligadas ?? []).map((t) => String(t.classroom_curso)));
  const admin = criarClienteAdmin();

  let cursos: { id: string; nome: string; detalhe: string }[] = [];
  let erroCursos = "";
  if (conectado && admin) {
    const a = await acessoDoClassroom(admin, meuId);
    if (!a) erroCursos = "A conexão com o Google Classroom expirou. Conecte de novo em Contas conectadas.";
    else {
      try {
        cursos = (await meusCursos(a.acesso)).filter((c) => !jaLigadas.has(c.id)).map((c) => ({ id: c.id, nome: c.name, detalhe: c.section ?? "" }));
      } catch (e) {
        erroCursos = e instanceof ErroClassroom ? e.message : "Não foi possível ver suas salas do Classroom agora. Atualize a página.";
      }
    }
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">
          Nov{o(vc, "espaco")} {vc.espaco.toLowerCase()} do Google Classroom
        </h1>
        <p className="text-sm text-suave">Escolha uma sala sua. Ela vira {o(vc, "espaco") === "a" ? "uma" : "um"} {vc.espaco.toLowerCase()} nov{o(vc, "espaco")}, com o nome da sala, e os alunos, as tarefas e as entregas vêm sozinhos.</p>
      </div>
      <ContaNecessaria slug={slug} nome="Google Classroom" conta={conectado ? conectado.email : con?.invalida ? "expirou" : null} />

      {conectado ? (
        <section aria-label="Ligar uma sala do Classroom" className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
          <h2 className="font-semibold">Qual sala?</h2>
          {ligadas?.length ? (
            <p className="text-sm">
              <span className="text-suave">Já ligadas:</span> {ligadas.map((t) => t.nome).join(", ")}
            </p>
          ) : null}
          {erroCursos ? (
            <Aviso tipo="erro">{erroCursos}</Aviso>
          ) : cursos.length ? (
            <EscolherTurma slug={slug} cursos={cursos} />
          ) : (
            <p className="text-sm text-suave">{ligadas?.length ? "Todas as suas salas do Classroom já estão ligadas." : "Nenhuma sala ativa em que você é professor apareceu no seu Classroom."}</p>
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-1 rounded-2xl bg-alerta-fundo px-4 py-3 text-sm text-alerta">
        <strong>Bom saber</strong>
        <span>
          O Google só deixa o Handback lançar nota em tarefa que ele mesmo criou. Crie {vc.etapas.toLowerCase()} pelo Handback e marque “Publicar também no Classroom”. Nas tarefas
          criadas direto no Classroom, lance a nota lá.
        </span>
        <span>O Google não deixa apps escreverem comentários no Classroom: a devolutiva escrita vai por e-mail, como sempre.</span>
        <span>Os arquivos que os alunos anexam ficam no Drive deles: você escolhe trazê-los na janela do Google, com um toque.</span>
      </section>
    </div>
  );
}

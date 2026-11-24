import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AvisoGmail } from "@/components/aviso-gmail";
import { ConectarGmail } from "@/components/conectar-gmail";
import { BotaoConfirmar, FormAcao } from "@/components/form-acao";
import { Aviso, Campo } from "@/components/ui";
import { ErroClassroom, meusCursos } from "@/lib/classroom/cliente";
import { acessoDoClassroom } from "@/lib/classroom/sincronizar";
import { contextoDaEmpresa } from "@/lib/empresa";
import { gmailConfigurado } from "@/lib/gmail";
import { completarVocabulario } from "@/lib/nomes";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { turmaAtual } from "@/lib/turma";
import { salvarNotasMoodle } from "../../moodle/acoes";
import { desconectarClassroom } from "./acoes";
import { AcoesLigada, EscolherTurma } from "./painel";

export const metadata: Metadata = { title: "Google Classroom" };
export const maxDuration = 60;

export default async function Classroom({ params, searchParams }: PageProps<"/app/[slug]/configuracoes/classroom">) {
  const { slug } = await params;
  const { gmail: aviso } = await searchParams;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const turma = await turmaAtual(empresa.id);
  if (!turma) notFound();
  const vc = completarVocabulario(empresa.vocabulario);
  const supabase = await criarClienteServidor();
  const [{ data: eu }, { data: con }, { data: config }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("conexoes_google").select("email, conectada_em, invalida").eq("servico", "classroom").maybeSingle(),
    supabase.from("organizacoes").select("notas_moodle").eq("id", empresa.id).single(),
  ]);
  const meuId = eu.user?.id ?? "";
  const conectado = con && !con.invalida ? con : null;
  const ligada = Boolean(turma.classroom_curso);
  const minha = ligada && turma.classroom_por === meuId;
  const admin = criarClienteAdmin();

  // Salas do Classroom já ligadas a turmas suas (cada sala vira uma turma própria).
  const { data: ligadas } = await supabase.from("turmas").select("id, nome, classroom_curso").eq("org_id", empresa.id).eq("classroom_por", meuId).not("classroom_curso", "is", null);
  const jaLigadas = new Set((ligadas ?? []).map((t) => String(t.classroom_curso)));
  // Salas do Classroom para escolher (só quando conectado).
  let cursos: { id: string; nome: string; detalhe: string }[] = [];
  let erroCursos = "";
  if (conectado && admin) {
    const a = await acessoDoClassroom(admin, meuId);
    if (!a) erroCursos = "A conexão com o Google Classroom expirou. Conecte de novo.";
    else {
      try {
        cursos = (await meusCursos(a.acesso)).filter((c) => !jaLigadas.has(c.id)).map((c) => ({ id: c.id, nome: c.name, detalhe: c.section ?? "" }));
      } catch (e) {
        erroCursos = e instanceof ErroClassroom ? e.message : "Não foi possível ver suas turmas do Classroom agora. Atualize a página.";
      }
    }
  }

  const [{ count: ciclos }, { count: entregas }, { count: esperando }] = ligada
    ? await Promise.all([
        supabase.from("etapas").select("id", { count: "exact", head: true }).eq("turma_id", turma.id).not("classroom_tarefa", "is", null),
        supabase.from("entregas").select("id, etapas!inner(turma_id)", { count: "exact", head: true }).eq("etapas.turma_id", turma.id).eq("origem", "classroom"),
        supabase.from("classroom_pendentes").select("drive_id, etapas!inner(turma_id)", { count: "exact", head: true }).eq("etapas.turma_id", turma.id),
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }];
  const notas = (config?.notas_moodle ?? {}) as Record<string, number>;
  const voltar = `/app/${slug}/configuracoes/classroom`;

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Google Classroom</h1>
        <p className="text-sm text-suave">
          Traz os alunos, as tarefas e as entregas das suas salas do Classroom e lança a nota lá dentro. Turma escolhida agora: <strong>{turma.nome}</strong>.
        </p>
      </div>
      <AvisoGmail aviso={aviso} servico="classroom" />

      <section aria-label="Sua conta Google" className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
        <h2 className="font-semibold">Sua conta Google</h2>
        {!gmailConfigurado() ? (
          <p className="text-sm text-suave">A conexão com o Google ainda não foi configurada no servidor.</p>
        ) : conectado ? (
          <>
            <p className="text-sm">
              <strong className="break-all">{conectado.email}</strong>
              <span className="text-suave"> · conectado em {dataHoraBR(conectado.conectada_em)}</span>
            </p>
            <p className="text-xs text-suave">Permissão: suas turmas, alunos, tarefas e notas. Do seu Drive, só os arquivos que você escolher.</p>
            <BotaoConfirmar
              acao={desconectarClassroom.bind(null, slug)}
              pergunta="Desconectar o Google Classroom? As turmas ligadas param de buscar novidades. O que já veio continua no Handback."
            >
              Desconectar Google Classroom
            </BotaoConfirmar>
          </>
        ) : (
          <>
            <p className="text-sm text-suave">
              {con?.invalida ? "A conexão expirou. " : ""}Cada professor conecta a própria conta. O Google mostra o que o Handback vai poder fazer: ver suas turmas,
              alunos e tarefas, criar tarefas e lançar notas.
            </p>
            <ConectarGmail voltar={voltar} servico="classroom" texto="Conectar Google Classroom" />
          </>
        )}
      </section>

      {ligada ? (
        <section aria-label="Turma do Classroom" className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
          <h2 className="font-semibold">Turma do Classroom</h2>
          <p className="text-sm font-semibold">{turma.classroom_curso_nome || "Turma do Classroom"}</p>
          <Aviso>
            {ciclos ?? 0} {ciclos === 1 ? `tarefa virou ${vc.etapa.toLowerCase()}` : `tarefas viraram ${vc.etapas.toLowerCase()}`} e {entregas ?? 0}{" "}
            {entregas === 1 ? "entrega chegou" : "entregas chegaram"}
            {esperando ? ` (${esperando} ${esperando === 1 ? "arquivo espera" : "arquivos esperam"} você trazer na página de cada ${vc.etapa.toLowerCase()})` : ""}. O
            Handback olha o Classroom sozinho quando você abre as entregas
            {turma.classroom_buscado_em ? ` · última busca ${dataHoraBR(turma.classroom_buscado_em)}` : ""}.
          </Aviso>
          {turma.classroom_erro ? <Aviso tipo="erro">A última busca falhou: {turma.classroom_erro}</Aviso> : null}
          {!minha ? <p className="text-sm text-suave">Ligada por outra pessoa da equipe. Só ela busca e traz os arquivos.</p> : null}
          <AcoesLigada slug={slug} podeDesligar />
        </section>
      ) : null}

      {conectado ? (
        <section aria-label="Ligar uma sala do Classroom" className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
          <div>
            <h2 className="font-semibold">Ligar uma sala do Classroom</h2>
            <p className="text-sm text-suave">Cada sala vira uma turma nova no Handback, com o nome da sala. Não se mistura com as turmas do Moodle nem com as outras.</p>
          </div>
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

      <section id="notas" aria-label="Nota no Classroom" className="flex scroll-mt-6 flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
        <div>
          <h2 className="font-semibold">Nota para cada conceito</h2>
          <p className="text-sm text-suave">Porcentagem da nota máxima da tarefa. Ex.: BOM = 80% de 10 = 8,0. Vale também para o Moodle.</p>
        </div>
        <FormAcao acao={salvarNotasMoodle.bind(null, slug)} textoBotao="Salvar notas">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(["EXCELENTE", "BOM", "REGULAR", "RUIM"] as const).map((c) => (
              <Campo key={c} rotulo={`${c} (%)`} name={`nota_${c}`} inputMode="decimal" required defaultValue={String(notas[c] ?? "")} />
            ))}
          </div>
        </FormAcao>
      </section>

      <section className="flex flex-col gap-1 rounded-2xl bg-alerta-fundo px-4 py-3 text-sm text-alerta">
        <strong>Bom saber</strong>
        <span>
          O Google só deixa o Handback lançar nota em tarefa que ele mesmo criou. Para isso, use “Publicar no Classroom” na página de cada {vc.etapa.toLowerCase()}. Nas
          tarefas criadas direto no Classroom, lance a nota lá.
        </span>
        <span>O Google não deixa apps escreverem comentários no Classroom: a devolutiva escrita vai por e-mail, como sempre.</span>
        <span>Os arquivos que os alunos anexam ficam no Drive deles: você escolhe trazê-los na janela do Google, com um toque.</span>
      </section>
    </div>
  );
}

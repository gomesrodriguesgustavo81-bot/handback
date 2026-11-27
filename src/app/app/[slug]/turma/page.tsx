import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlocoAjuste } from "@/components/bloco-ajuste";
import { FormAcao } from "@/components/form-acao";
import { Aviso, Campo, Escolha, LinkBotao } from "@/components/ui";
import { enderecoDeRecebimento } from "@/lib/emails/endereco";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario, o } from "@/lib/nomes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { turmaAtual } from "@/lib/turma";
import { salvarTurma } from "../ajustes/acoes";
import { AcoesLigada } from "../configuracoes/classroom/painel";
import { BotaoConfirmar } from "@/components/form-acao";
import { ligarPiloto } from "../turma-acoes";
import { EscolhasIACampos } from "@/components/escolhas-ia";
import { COLUNAS_ESCOLHAS, resolverEscolhas, type LinhaEscolhas } from "@/lib/ia/escolhas";
import { salvarEscolhasTurma } from "../ia-acoes";

export const metadata: Metadata = { title: "Ajustes da turma" };

/**
 * Ajustes da turma: tudo o que vale só para a turma escolhida no topo, em
 * blocos que abrem e fecham. As contas (Gmail, Google, Moodle) ficam em
 * Contas conectadas; aqui só se escolhe o que esta turma usa.
 */
export default async function AjustesDaTurma({ params }: PageProps<"/app/[slug]/turma">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const turma = await turmaAtual(empresa.id);
  if (!turma) notFound();
  const vc = completarVocabulario(empresa.vocabulario);
  const a = o(vc, "espaco");
  const nomeTurma = `${vc.espaco.toLowerCase()}`;
  const supabase = await criarClienteServidor();
  const base = `/app/${slug}`;
  const [{ data: eu }, { data: t }, { count: ciclosClassroom }, { count: esperando }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("turmas").select("piloto, drive_por, agenda_por, lembrete_por, lembrete_abre, lembrete_dois_dias, lembrete_no_dia, moodle_curso_nome").eq("id", turma.id).single(),
    turma.classroom_curso
      ? supabase.from("etapas").select("id", { count: "exact", head: true }).eq("turma_id", turma.id).not("classroom_tarefa", "is", null)
      : Promise.resolve({ count: 0 }),
    turma.classroom_curso
      ? supabase.from("classroom_pendentes").select("drive_id, etapas!inner(turma_id)", { count: "exact", head: true }).eq("etapas.turma_id", turma.id)
      : Promise.resolve({ count: 0 }),
  ]);
  const meuId = eu.user?.id ?? "";
  const [{ data: contaIA }, { data: turmaIA }] = await Promise.all([
    supabase.from("organizacoes").select(COLUNAS_ESCOLHAS).eq("id", empresa.id).maybeSingle(),
    supabase.from("turmas").select(COLUNAS_ESCOLHAS).eq("id", turma.id).maybeSingle(),
  ]);
  const escolhasIA = resolverEscolhas(contaIA as LinhaEscolhas | null, turmaIA as LinhaEscolhas | null);
  const endereco = enderecoDeRecebimento(turma.caixa_token);
  const lembretes = [t?.lembrete_abre && "quando abre", t?.lembrete_dois_dias && "2 dias antes", t?.lembrete_no_dia && "no dia"].filter(Boolean) as string[];
  const deOutro = (por: string | null | undefined) => Boolean(por && por !== meuId);

  const origem = turma.classroom_curso
    ? { selo: "Classroom", tom: "info" as const, resumo: `Sala “${turma.classroom_curso_nome || "do Classroom"}”` }
    : turma.moodle_conta
      ? { selo: "Moodle", tom: "info" as const, resumo: `Disciplina “${turma.moodle_curso_nome || t?.moodle_curso_nome || "do Moodle"}”` }
      : { selo: "E-mail", tom: "ok" as const, resumo: "Os alunos mandam para o endereço da turma" };

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <div>
        <h1 className="text-2xl font-bold">
          Ajustes d{a} {nomeTurma}
        </h1>
        <p className="text-sm text-suave">
          Tudo o que vale só para <strong>{turma.nome}</strong>. As contas você conecta em Contas conectadas.
        </p>
      </div>

      <BlocoAjuste titulo="De onde vêm as entregas" resumo={origem.resumo} selo={origem.selo} tom={origem.tom} aberto>
        {turma.classroom_curso ? (
          <>
            <p>
              Alunos, tarefas e entregas chegam sozinhos da sala do Google Classroom quando você abre as entregas.
              {turma.classroom_buscado_em ? ` Última busca: ${dataHoraBR(turma.classroom_buscado_em)}.` : ""}
            </p>
            <p className="text-suave">
              {ciclosClassroom ?? 0} {ciclosClassroom === 1 ? `tarefa virou ${vc.etapa.toLowerCase()}` : `tarefas viraram ${vc.etapas.toLowerCase()}`}
              {esperando ? ` · ${esperando} ${esperando === 1 ? "arquivo espera" : "arquivos esperam"} você trazer` : ""}.
            </p>
            {turma.classroom_erro ? <Aviso tipo="erro">A última busca falhou: {turma.classroom_erro}</Aviso> : null}
            {deOutro(turma.classroom_por) ? <p className="text-suave">Ligada por outra pessoa da equipe. Só ela busca e traz os arquivos.</p> : null}
            <AcoesLigada slug={slug} podeDesligar />
          </>
        ) : turma.moodle_conta ? (
          <>
            <p>Alunos, grupos, tarefas e entregas chegam do Moodle sozinhos quando você abre as entregas.{turma.moodle_buscado_em ? ` Última busca: ${dataHoraBR(turma.moodle_buscado_em)}.` : ""}</p>
            {turma.moodle_erro ? <Aviso tipo="erro">A última busca falhou: {turma.moodle_erro}</Aviso> : null}
            <LinkBotao href={`${base}/entregas`} className="self-start">
              Buscar e escolher as tarefas
            </LinkBotao>
          </>
        ) : (
          <>
            <p>
              Os alunos mandam as entregas para <strong className="break-all">{endereco}</strong>. O Handback separa por {vc.etapa.toLowerCase()} e por{" "}
              {turma.modo === "individual" ? vc.pessoa.toLowerCase() : vc.grupo.toLowerCase()}.
            </p>
            <LinkBotao href={`${base}/configuracoes/recebimento`} className="self-start">
              Mensagem para a turma e etiqueta
            </LinkBotao>
          </>
        )}
      </BlocoAjuste>

      <BlocoAjuste
        titulo="Piloto automático"
        resumo={t?.piloto ? "O que chega já vai para a IA" : "A IA analisa quando você pede"}
        selo={t?.piloto ? "Ligado" : "Desligado"}
        tom={t?.piloto ? "ok" : "neutro"}
      >
        <p>
          Com o piloto ligado, cada entrega que chega {turma.classroom_curso || turma.moodle_conta ? `(e o Handback busca no ${turma.classroom_curso ? "Classroom" : "Moodle"} todo dia sozinho) ` : ""}
          já vai para a IA. Você recebe um aviso: “N análises prontas”.
        </p>
        <p className="text-suave">
          Nada sai para o aluno sem você: revisar e aprovar continua com você.
          {turma.classroom_curso ? " Os arquivos que ficam no Drive dos alunos ainda pedem um toque seu em “Trazer os arquivos” (regra do Google)." : ""}
        </p>
        <BotaoConfirmar
          acao={ligarPiloto.bind(null, slug, !t?.piloto)}
          perigo={false}
          pergunta={t?.piloto ? "Desligar o piloto automático?" : "Ligar o piloto automático?"}
          texto={t?.piloto ? "As entregas novas esperam você pedir a análise." : "O que já chegou e ainda não foi analisado entra na fila da IA agora. Nada é enviado aos alunos."}
          sim={t?.piloto ? "Sim, desligar" : "Sim, ligar"}
        >
          {t?.piloto ? "Desligar o piloto" : "Ligar o piloto automático"}
        </BotaoConfirmar>
      </BlocoAjuste>

      {turma.classroom_curso || turma.moodle_conta ? (
        <BlocoAjuste titulo="Receber também por e-mail" resumo={endereco ?? ""} selo="Endereço" tom="neutro">
          <p>Quem preferir pode mandar para o endereço da turma, e a entrega cai aqui do mesmo jeito.</p>
          <LinkBotao href={`${base}/configuracoes/recebimento`} variante="secundario" className="self-start" transitionTypes={["nav-forward"]}>
            Endereço e etiqueta
          </LinkBotao>
        </BlocoAjuste>
      ) : null}

      <BlocoAjuste
        titulo="Pasta no Google Drive"
        resumo="Os arquivos desta turma numa pasta sua"
        selo={t?.drive_por ? (deOutro(t.drive_por) ? "De outra pessoa" : "Ligada") : "Desligada"}
        tom={t?.drive_por ? "ok" : "neutro"}
      >
        <p>Guarda os arquivos das entregas em Handback › {turma.nome} › cada {(turma.modo === "individual" ? vc.pessoa : vc.grupo).toLowerCase()} no seu Google Drive.</p>
        <LinkBotao href={`${base}/configuracoes/drive`} variante="secundario" className="self-start" transitionTypes={["nav-forward"]}>
          Abrir a pasta no Drive
        </LinkBotao>
      </BlocoAjuste>

      <BlocoAjuste
        titulo="Prazos no Google Agenda"
        resumo={`Abre e prazo de cada ${vc.etapa.toLowerCase()}`}
        selo={t?.agenda_por ? (deOutro(t.agenda_por) ? "De outra pessoa" : "Ligada") : "Desligada"}
        tom={t?.agenda_por ? "ok" : "neutro"}
      >
        <p>Os prazos desta turma aparecem numa agenda sua e mudam sozinhos quando você muda uma data aqui.</p>
        <LinkBotao href={`${base}/configuracoes/agenda`} variante="secundario" className="self-start" transitionTypes={["nav-forward"]}>
          Abrir os prazos na agenda
        </LinkBotao>
      </BlocoAjuste>

      <BlocoAjuste
        titulo="Lembretes para os alunos"
        resumo={lembretes.length ? `E-mail ${lembretes.join(", ")}` : "E-mail para quem ainda não entregou"}
        selo={lembretes.length ? "Ligados" : "Desligados"}
        tom={lembretes.length ? "ok" : "neutro"}
      >
        <p>Um e-mail curto para quem ainda não entregou, saindo do seu Gmail.</p>
        <LinkBotao href={`${base}/configuracoes/lembretes`} variante="secundario" className="self-start" transitionTypes={["nav-forward"]}>
          Escolher os lembretes
        </LinkBotao>
      </BlocoAjuste>

      <BlocoAjuste titulo="Nome e quem entrega" resumo={`${turma.nome} · ${turma.modo === "individual" ? `cada ${vc.pessoa.toLowerCase()}` : vc.grupos.toLowerCase()}`}>
        <FormAcao acao={salvarTurma.bind(null, slug, turma.id)} textoBotao="Salvar">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome" name="nome" required defaultValue={turma.nome} />
            <Escolha
              rotulo="Quem entrega"
              name="modo"
              defaultValue={turma.modo}
              opcoes={[
                { valor: "grupos", nome: `${vc.grupos} (com ${vc.pessoas.toLowerCase()} dentro)` },
                { valor: "individual", nome: `${vc.pessoas} individualmente` },
              ]}
            />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="arquivada" defaultChecked={turma.arquivada} className="size-5" />
            Arquivada (some do topo, mas nada é apagado)
          </label>
        </FormAcao>
      </BlocoAjuste>

      <BlocoAjuste
        titulo="IA e proteção de dados"
        resumo={escolhasIA.semSugestao ? "Sem sugestão de conceito" : escolhasIA.exigirConceito ? "A IA sugere, você escolhe o conceito" : "A IA sugere o conceito"}
        selo={escolhasIA.nomeCodigo && escolhasIA.esconderDados ? "Dados protegidos" : "Revise"}
        tom={escolhasIA.nomeCodigo && escolhasIA.esconderDados ? "ok" : "alerta"}
      >
        <p className="text-suave">
          Começa com o que você escolheu ao criar a conta; aqui vale só para <strong>{turma.nome}</strong>. A conta toda se muda em{" "}
          <a href={`/app/${slug}/configuracoes/ia`} className="font-semibold text-marca-forte underline">
            Configurações
          </a>
          .
        </p>
        <FormAcao acao={salvarEscolhasTurma.bind(null, slug)} textoBotao="Salvar escolhas desta turma">
          <EscolhasIACampos valores={escolhasIA} />
        </FormAcao>
      </BlocoAjuste>
    </div>
  );
}

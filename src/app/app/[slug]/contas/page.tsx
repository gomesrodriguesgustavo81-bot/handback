import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AvisoGmail } from "@/components/aviso-gmail";
import { ConectarGmail } from "@/components/conectar-gmail";
import { BotaoConfirmar } from "@/components/form-acao";
import { LinkBotao } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { gmailConfigurado } from "@/lib/gmail";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { desconectarAgenda } from "../configuracoes/agenda/acoes";
import { desconectarClassroom } from "../configuracoes/classroom/acoes";
import { desconectarDrive } from "../configuracoes/drive/acoes";
import { desconectarGmail } from "../entregas/acoes";
import { desligarMoodle } from "../moodle/acoes";

export const metadata: Metadata = { title: "Contas conectadas" };

type Estado = "conectada" | "expirou" | "desconectada";
const SELO: Record<Estado, { texto: string; classe: string }> = {
  conectada: { texto: "Conectado", classe: "bg-ok-fundo text-ok" },
  expirou: { texto: "Expirou", classe: "bg-alerta-fundo text-alerta" },
  desconectada: { texto: "Desconectado", classe: "bg-neutro-fundo text-neutro" },
};

/** Um cartão de conta: todos iguais (nome, para que serve, estado e um botão). */
function CartaoConta({ nome, para, letra, cor, estado, detalhe, children }: { nome: string; para: string; letra: string; cor: string; estado: Estado; detalhe?: string; children: ReactNode }) {
  return (
    <section aria-label={nome} className="flex flex-col gap-2.5 rounded-2xl border border-borda bg-cartao p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ${cor}`}>
          {letra}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{nome}</span>
          <span className="text-xs text-suave">{para}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${SELO[estado].classe}`}>{SELO[estado].texto}</span>
      </div>
      {detalhe ? <p className="break-words text-[13px] text-suave">{detalhe}</p> : null}
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

/**
 * Contas conectadas: aqui só se conecta e desconecta. Cada pessoa conecta a
 * própria conta; o que cada turma usa fica em Ajustes da turma.
 */
export default async function Contas({ params, searchParams }: PageProps<"/app/[slug]/contas">) {
  const { slug } = await params;
  const { gmail: aviso } = await searchParams;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const supabase = await criarClienteServidor();
  const [{ data: gmail }, { data: google }, { data: moodle }] = await Promise.all([
    supabase.from("contas_gmail").select("email, conectada_em, invalida").maybeSingle(),
    supabase.from("conexoes_google").select("servico, email, conectada_em, invalida"),
    supabase.from("contas_moodle").select("id, site, site_nome, nome, invalida").eq("org_id", empresa.id).order("conectada_em", { ascending: false }),
  ]);
  const voltar = `/app/${slug}/contas`;
  const configurado = gmailConfigurado();
  const estadoDe = (c: { invalida: boolean } | null | undefined): Estado => (!c ? "desconectada" : c.invalida ? "expirou" : "conectada");
  const doGoogle = (s: string) => (google ?? []).find((g) => g.servico === s) ?? null;
  const quando = (c: { email: string; conectada_em: string }) => `${c.email} · conectado em ${dataHoraBR(c.conectada_em)}`;
  const moodleOk = (moodle ?? []).find((m) => !m.invalida) ?? null;
  const moodleEstado: Estado = moodleOk ? "conectada" : (moodle ?? []).length ? "expirou" : "desconectada";

  const google3 = [
    {
      servico: "classroom" as const,
      nome: "Google Classroom",
      para: "Trazer alunos, tarefas e entregas; lançar notas",
      letra: "C",
      cor: "bg-info-fundo text-info",
      extra: "Só suas salas, alunos, tarefas e notas. Do Drive, só os arquivos que você escolher.",
      sair: desconectarClassroom,
      pergunta: "Desconectar o Google Classroom? As turmas ligadas param de buscar novidades. O que já veio continua no Handback.",
    },
    {
      servico: "drive" as const,
      nome: "Google Drive",
      para: "Guardar os arquivos das entregas numa pasta sua",
      letra: "D",
      cor: "bg-ok-fundo text-ok",
      extra: "Só as pastas e arquivos que o Handback criar.",
      sair: desconectarDrive,
      pergunta: "Desconectar o Google Drive? Os arquivos continuam no seu Drive, mas o Handback deixa de conseguir abrir e analisar os que estão lá.",
    },
    {
      servico: "agenda" as const,
      nome: "Google Agenda",
      para: "Os prazos das turmas na sua agenda",
      letra: "A",
      cor: "bg-alerta-fundo text-alerta",
      extra: "Só as agendas que o Handback criar.",
      sair: desconectarAgenda,
      pergunta: "Desconectar o Google Agenda? As agendas que o Handback criou continuam na sua conta, mas param de ser atualizadas.",
    },
  ];

  return (
    <div className="flex max-w-xl flex-col gap-3">
      <div>
        <h1 className="text-2xl font-bold">Contas conectadas</h1>
        <p className="text-sm text-suave">Ligue suas contas uma vez. Cada pessoa conecta a própria. O que cada turma usa fica em Ajustes da turma.</p>
      </div>
      <AvisoGmail aviso={aviso} />
      {!configurado ? <p className="rounded-2xl border border-borda bg-cartao p-4 text-sm text-suave">A conexão com o Google ainda não foi configurada no servidor.</p> : null}

      <CartaoConta
        nome="Gmail"
        para="Enviar as devolutivas do seu e-mail"
        letra="G"
        cor="bg-erro-fundo text-erro"
        estado={estadoDe(gmail)}
        detalhe={gmail && !gmail.invalida ? `${quando(gmail)} · só envia, não lê sua caixa` : "O Handback só envia; não lê sua caixa."}
      >
        {gmail && !gmail.invalida ? (
          <BotaoConfirmar acao={desconectarGmail.bind(null, slug)} pergunta="Desconectar o Gmail? As devolutivas param de sair do seu Gmail até você conectar de novo. Nada é apagado.">
            Desconectar Gmail
          </BotaoConfirmar>
        ) : configurado ? (
          <ConectarGmail voltar={voltar} texto="Conectar Gmail" destaque={false} />
        ) : null}
      </CartaoConta>

      {google3.map((g) => {
        const c = doGoogle(g.servico);
        const ok = c && !c.invalida;
        return (
          <CartaoConta key={g.servico} nome={g.nome} para={g.para} letra={g.letra} cor={g.cor} estado={estadoDe(c)} detalhe={ok ? `${quando(c)} · ${g.extra}` : g.extra}>
            {ok ? (
              <BotaoConfirmar acao={g.sair.bind(null, slug)} pergunta={g.pergunta}>
                Desconectar {g.nome}
              </BotaoConfirmar>
            ) : configurado ? (
              <ConectarGmail voltar={voltar} servico={g.servico} texto={`Conectar ${g.nome}`} destaque={false} />
            ) : null}
          </CartaoConta>
        );
      })}

      <CartaoConta
        nome="Moodle"
        para="Trazer disciplinas e devolver no Moodle"
        letra="M"
        cor="bg-neutro-fundo text-neutro"
        estado={moodleEstado}
        detalhe={moodleOk ? `Conectado como ${moodleOk.nome || "?"} · ${moodleOk.site_nome || moodleOk.site}` : "Entra com o seu login do Moodle da escola."}
      >
        {moodleOk ? (
          <BotaoConfirmar acao={desligarMoodle.bind(null, slug, moodleOk.id)} pergunta="Desconectar o Moodle? As turmas e entregas que já vieram continuam aqui, mas param de atualizar.">
            Desconectar Moodle
          </BotaoConfirmar>
        ) : (
          <LinkBotao href={`/app/${slug}/moodle`} className="text-sm">
            {moodleEstado === "expirou" ? "Conectar Moodle de novo" : "Conectar Moodle"}
          </LinkBotao>
        )}
      </CartaoConta>
    </div>
  );
}

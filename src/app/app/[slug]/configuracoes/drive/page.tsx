import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AvisoGmail } from "@/components/aviso-gmail";
import { ConectarGmail } from "@/components/conectar-gmail";
import { BotaoConfirmar } from "@/components/form-acao";
import { contextoDaEmpresa } from "@/lib/empresa";
import { gmailConfigurado } from "@/lib/gmail";
import { completarVocabulario } from "@/lib/nomes";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { turmaAtual } from "@/lib/turma";
import { desconectarDrive, levarAgora } from "./acoes";
import { Antigos, LigarDrive } from "./painel";

export const metadata: Metadata = { title: "Google Drive" };

export default async function Drive({ params, searchParams }: PageProps<"/app/[slug]/configuracoes/drive">) {
  const { slug } = await params;
  const { gmail: aviso } = await searchParams;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const turma = await turmaAtual(empresa.id);
  if (!turma) notFound();
  const vc = completarVocabulario(empresa.vocabulario);
  const supabase = await criarClienteServidor();
  const [{ data: eu }, { data: con }, { data: t }, { data: sit }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("conexoes_google").select("email, conectada_em, invalida").eq("servico", "drive").maybeSingle(),
    supabase.from("turmas").select("drive_por, drive_antigos, drive_erro").eq("id", turma.id).single(),
    supabase.rpc("situacao_drive", { p_turma: turma.id }),
  ]);
  const admin = criarClienteAdmin();
  const dono =
    t?.drive_por && t.drive_por !== eu.user?.id && admin ? await admin.auth.admin.getUserById(t.drive_por).then((x) => x.data.user?.email ?? "outra pessoa") : null;
  const conectado = con && !con.invalida ? con : null;
  const meu = Boolean(t?.drive_por && t.drive_por === eu.user?.id);
  const s = (sit ?? {}) as { no_drive?: number; esperando?: number; com_erro?: number };
  const grupoMin = vc.grupo.toLowerCase();

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Google Drive</h1>
        <p className="text-sm text-suave">
          Da turma <strong>{turma.nome}</strong>. Os arquivos das entregas vão para uma pasta no Drive, e o Handback continua abrindo e analisando normalmente.
        </p>
      </div>
      <AvisoGmail aviso={aviso} servico="drive" />

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
            <p className="text-xs text-suave">Permissão: só as pastas e arquivos que o Handback criar. Ele não vê o resto do seu Drive.</p>
            <BotaoConfirmar
              acao={desconectarDrive.bind(null, slug)}
              pergunta="Desconectar o Google Drive? Os arquivos continuam no seu Drive, mas o Handback deixa de conseguir abrir e analisar os que estão lá."
            >
              Desconectar Google Drive
            </BotaoConfirmar>
          </>
        ) : (
          <>
            <p className="text-sm text-suave">
              {con?.invalida ? "A conexão expirou. " : ""}Cada pessoa conecta a própria conta. O Handback só mexe nas pastas que ele mesmo criar.
            </p>
            <ConectarGmail voltar={`/app/${slug}/configuracoes/drive`} servico="drive" texto="Conectar Google Drive" />
          </>
        )}
      </section>

      <section aria-label="Arquivos da turma" className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
        <LigarDrive slug={slug} ligado={meu} podeLigar={Boolean(conectado)} deOutro={dono} />
        {dono ? <p className="text-sm text-suave">Hoje os arquivos desta turma vão para o Drive de {dono}.</p> : null}
        {meu || s.no_drive ? (
          <p className="text-sm text-suave">
            {s.no_drive ?? 0} {s.no_drive === 1 ? "arquivo" : "arquivos"} no Drive
            {s.esperando ? ` · ${s.esperando} esperando para ir` : ""}
            {s.com_erro ? ` · ${s.com_erro} com problema` : ""}. Pastas: Handback › {turma.nome} › cada {grupoMin}.
          </p>
        ) : null}
        {meu && t?.drive_erro ? <p className="rounded-xl bg-erro-fundo px-3 py-2 text-sm text-erro">{t.drive_erro}</p> : null}
        {meu && s.esperando ? (
          <BotaoConfirmar acao={levarAgora.bind(null, slug)} pergunta={`Levar agora os ${s.esperando} arquivos para o Drive?`} sim="Sim, levar" perigo={false}>
            Levar agora
          </BotaoConfirmar>
        ) : null}
      </section>

      {meu ? <Antigos slug={slug} mover={Boolean(t?.drive_antigos)} /> : null}

      <section className="flex flex-col gap-1 rounded-2xl bg-alerta-fundo px-4 py-3 text-sm text-alerta">
        <strong>Bom saber</strong>
        <span>Os arquivos ficam no Drive de quem ligou. Os outros professores da turma continuam abrindo pelo Handback normalmente.</span>
        <span>Se essa pessoa desconectar o Drive, os arquivos continuam no Drive dela, mas o Handback para de conseguir abrir e analisar.</span>
      </section>
    </div>
  );
}

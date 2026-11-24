import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotaoConfirmar } from "@/components/form-acao";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario } from "@/lib/nomes";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";
import { levarAgora } from "./acoes";
import { ContaNecessaria } from "@/components/conta-necessaria";
import { Antigos, LigarDrive } from "./painel";
import { linksDasPastas } from "@/lib/drive";
import { IconeDrive } from "@/lib/pastas-drive";

export const metadata: Metadata = { title: "Pasta no Google Drive" };

export default async function Drive({ params }: PageProps<"/app/[slug]/configuracoes/drive">) {
  const { slug } = await params;
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
  const pastas = meu && admin && eu.user ? await linksDasPastas(admin, eu.user.id, [`turma:${turma.id}`, "raiz"]) : {};
  const pasta = pastas[`turma:${turma.id}`] ?? pastas.raiz ?? null;
  const s = (sit ?? {}) as { no_drive?: number; esperando?: number; com_erro?: number };
  const grupoMin = vc.grupo.toLowerCase();

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Pasta no Google Drive</h1>
        <p className="text-sm text-suave">
          Da turma <strong>{turma.nome}</strong>. Os arquivos das entregas vão para uma pasta no Drive, e o Handback continua abrindo e analisando normalmente.
        </p>
      </div>
      <ContaNecessaria slug={slug} nome="Google Drive" conta={conectado ? conectado.email : con?.invalida ? "expirou" : null} />

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
        {pasta ? (
          <a
            href={pasta}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl bg-marca px-4 text-sm font-semibold text-sobre-marca hover:bg-marca-forte"
          >
            <IconeDrive /> Abrir a pasta no Google Drive
          </a>
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

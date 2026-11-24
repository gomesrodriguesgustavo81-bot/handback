import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotaoConfirmar } from "@/components/form-acao";
import { contextoDaEmpresa } from "@/lib/empresa";
import { completarVocabulario } from "@/lib/nomes";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { turmaAtual } from "@/lib/turma";
import { atualizarAgendaAgora } from "./acoes";
import { ContaNecessaria } from "@/components/conta-necessaria";
import { ItensAgenda, LigarAgenda } from "./painel";

export const metadata: Metadata = { title: "Prazos no Google Agenda" };

export default async function Agenda({ params }: PageProps<"/app/[slug]/configuracoes/agenda">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const turma = await turmaAtual(empresa.id);
  if (!turma) notFound();
  const vc = completarVocabulario(empresa.vocabulario);
  const supabase = await criarClienteServidor();
  const [{ data: eu }, { data: con }, { data: t }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("conexoes_google").select("email, conectada_em, invalida").eq("servico", "agenda").maybeSingle(),
    supabase.from("turmas").select("agenda_por, agenda_id, agenda_itens, agenda_convidar, agenda_erro, agenda_em").eq("id", turma.id).single(),
  ]);
  const admin = criarClienteAdmin();
  const [{ count: eventos }, dono] = await Promise.all([
    admin ? admin.from("agenda_eventos").select("etapa_id", { count: "exact", head: true }).eq("turma_id", turma.id) : Promise.resolve({ count: 0 }),
    t?.agenda_por && t.agenda_por !== eu.user?.id && admin ? admin.auth.admin.getUserById(t.agenda_por).then((x) => x.data.user?.email ?? "outra pessoa") : Promise.resolve(null),
  ]);
  const conectado = con && !con.invalida ? con : null;
  const minha = Boolean(t?.agenda_por && t.agenda_por === eu.user?.id);

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Prazos no Google Agenda</h1>
        <p className="text-sm text-suave">
          Da turma <strong>{turma.nome}</strong>. Os prazos aparecem no seu Google Agenda e mudam sozinhos quando você muda uma data aqui.
        </p>
      </div>
      <ContaNecessaria slug={slug} nome="Google Agenda" conta={conectado ? conectado.email : con?.invalida ? "expirou" : null} />

      <section aria-label="Agenda da turma" className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
        <LigarAgenda slug={slug} ligada={minha} turma={turma.nome} podeLigar={Boolean(conectado)} deOutro={dono} />
        {dono ? <p className="text-sm text-suave">Hoje a agenda desta turma está na conta de {dono}.</p> : null}
        {minha ? (
          t?.agenda_erro ? (
            <p className="rounded-xl bg-erro-fundo px-3 py-2 text-sm text-erro">{t.agenda_erro}</p>
          ) : (
            <p className="text-sm text-suave">
              {eventos ?? 0} {eventos === 1 ? "evento" : "eventos"} na agenda{t?.agenda_em ? ` · atualizada em ${dataHoraBR(t.agenda_em)}` : ""}.
            </p>
          )
        ) : null}
        {minha ? (
          <BotaoConfirmar acao={atualizarAgendaAgora.bind(null, slug)} pergunta="Atualizar a agenda agora?" sim="Sim, atualizar" perigo={false}>
            Atualizar agora
          </BotaoConfirmar>
        ) : null}
      </section>

      {minha ? <ItensAgenda slug={slug} itens={(t?.agenda_itens as string[]) ?? []} convidar={Boolean(t?.agenda_convidar)} palavraEtapa={vc.etapa} /> : null}
    </div>
  );
}

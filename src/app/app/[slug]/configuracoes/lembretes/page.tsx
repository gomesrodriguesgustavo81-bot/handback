import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { proximosLembretes, NOME_LEMBRETE } from "@/lib/lembretes";
import { completarVocabulario } from "@/lib/nomes";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { criarClienteServidor } from "@/lib/supabase/server";
import { hojeISO } from "@/lib/textos";
import { turmaAtual } from "@/lib/turma";
import { CaixaLembrete, UsarMeuGmail } from "./escolhas";

export const metadata: Metadata = { title: "Lembretes para os alunos" };

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const diaCurto = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
};

export default async function Lembretes({ params }: PageProps<"/app/[slug]/configuracoes/lembretes">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const vc = completarVocabulario(empresa.vocabulario);
  const turma = await turmaAtual(empresa.id);
  if (!turma) notFound();
  const supabase = await criarClienteServidor();
  const [{ data: t }, { data: etapas }, { data: eu }] = await Promise.all([
    supabase.from("turmas").select("lembrete_abre, lembrete_dois_dias, lembrete_no_dia, lembrete_por").eq("id", turma.id).single(),
    supabase.from("etapas").select("id, numero, titulo, recebe_de, recebe_ate").eq("turma_id", turma.id).order("numero"),
    supabase.auth.getUser(),
  ]);
  const cfg = { lembrete_abre: Boolean(t?.lembrete_abre), lembrete_dois_dias: Boolean(t?.lembrete_dois_dias), lembrete_no_dia: Boolean(t?.lembrete_no_dia) };
  const algum = cfg.lembrete_abre || cfg.lembrete_dois_dias || cfg.lembrete_no_dia;
  // De quem é o Gmail que envia (o e-mail aparece para quem administra; o token nunca sai do servidor).
  const admin = criarClienteAdmin();
  const remetente = t?.lembrete_por && admin ? (await admin.from("contas_gmail").select("email, invalida").eq("user_id", t.lembrete_por).maybeSingle()).data : null;
  const souEu = t?.lembrete_por && t.lembrete_por === eu.user?.id;
  const hoje = hojeISO();
  const proximos = proximosLembretes(etapas ?? [], cfg, hoje);

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Lembretes para os alunos</h1>
        <p className="text-sm text-suave">
          Na turma <strong>{turma.nome}</strong>. Um e-mail curto para quem ainda não entregou, com o que entregar e como.
        </p>
      </div>
      <section aria-label="Quando lembrar" className="flex flex-col rounded-2xl border border-borda bg-cartao p-4">
        <h2 className="mb-1 font-semibold">Quando lembrar</h2>
        <CaixaLembrete slug={slug} campo="lembrete_abre" nome="Quando abre para entregas" inicial={cfg.lembrete_abre} />
        <CaixaLembrete slug={slug} campo="lembrete_dois_dias" nome="2 dias antes do prazo" inicial={cfg.lembrete_dois_dias} />
        <CaixaLembrete slug={slug} campo="lembrete_no_dia" nome="No dia do prazo" inicial={cfg.lembrete_no_dia} />
        <p className="mt-1 text-xs text-suave">Saem às 9h da manhã. Quem já entregou não recebe (no aviso de abertura, todos recebem).</p>
      </section>
      <section aria-label="Sai de qual e-mail" className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
        <h2 className="font-semibold">Sai de qual e-mail</h2>
        {remetente && !remetente.invalida ? (
          <p className="rounded-xl bg-marca-clara px-3 py-2 text-sm">
            <strong className="break-all">{remetente.email}</strong>
            <span className="text-suave"> · {souEu ? "seu Gmail conectado" : "Gmail de quem ligou os lembretes"}</span>
          </p>
        ) : algum ? (
          <p className="rounded-xl bg-alerta-fundo px-3 py-2 text-sm text-alerta">
            {souEu ? (
              <>
                Seu Gmail não está conectado: os lembretes não saem. <Link href={`/app/${slug}/contas`} className="font-semibold underline">Conectar meu Gmail</Link>
              </>
            ) : (
              "O Gmail de quem ligou os lembretes não está conectado: eles não saem."
            )}
          </p>
        ) : (
          <p className="text-sm text-suave">Do Gmail de quem ligar os lembretes. Os alunos respondem direto para essa pessoa.</p>
        )}
        {algum && !souEu ? <UsarMeuGmail slug={slug} /> : null}
      </section>
      {algum ? (
        <section aria-label="Próximos lembretes" className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
          <h2 className="font-semibold">Próximos lembretes</h2>
          {proximos.length ? (
            <ul className="flex flex-col gap-2">
              {proximos.map((p) => (
                <li key={`${p.etapa.id}-${p.tipo}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold">
                      {vc.etapa} {p.etapa.numero} · {p.etapa.titulo}
                    </span>
                    <span className="text-xs text-suave">
                      {diaCurto(p.dia)}, 9h · {NOME_LEMBRETE[p.tipo]}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-reg-fundo px-2.5 py-1 text-xs font-bold text-reg">{p.tipo === "abre" ? "todos" : "quem faltar"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-suave">Nenhum por enquanto: cadastre as datas de entrega em {vc.etapas.toLowerCase()}.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

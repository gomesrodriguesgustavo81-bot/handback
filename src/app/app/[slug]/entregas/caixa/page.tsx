import type { Metadata } from "next";
import { turmaAtual } from "@/lib/turma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisaoEmail } from "@/components/decisao-email";
import { Dobra } from "@/components/conceito";
import { EnderecoDaTurma } from "@/components/endereco-turma";
import { dadosDaMensagem } from "@/lib/mensagem-turma";
import { marcarMensagemCopiada } from "../../turma-acoes";
import { enderecoDeRecebimento } from "@/lib/emails/endereco";
import { Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR, tamanhoLegivel } from "@/lib/textos";
import { etapasDaEmpresa } from "../dados";
import { NavEntregas } from "../navegacao";

export const metadata: Metadata = { title: "Caixa de e-mails" };

const ABAS = {
  confirmar: "Para confirmar",
  ignorados: "Ignorados",
} as const;
type Aba = keyof typeof ABAS;
const STATUS_DA_ABA: Record<Aba, string> = { confirmar: "confirmar", ignorados: "ignorado" };
const GMAIL = "forwarding-noreply@google.com";

type Email = {
  id: string;
  enviado_em: string;
  de_email: string;
  de_nome: string;
  assunto: string;
  texto: string;
  links: string[];
  anexos: { nome: string; tamanho: number }[];
  anexos_pendentes: { nome: string; tamanho: number }[];
  status: string;
  motivo: string;
  avisos: string[];
  etapa_sugerida: string | null;
  grupo_sugerido: string | null;
};

export default async function CaixaDeEmails({ params, searchParams }: PageProps<"/app/[slug]/entregas/caixa">) {
  const { slug } = await params;
  const { ver } = await searchParams;
  const aba: Aba = typeof ver === "string" && ver in ABAS ? (ver as Aba) : "confirmar";
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) notFound();
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();

  const turma = await turmaAtual(empresa.id);
  const tId = turma?.id ?? "";
  const contar = (status: string) =>
    supabase.from("emails_recebidos").select("id", { count: "exact", head: true }).eq("org_id", empresa.id).eq("turma_id", tId).eq("status", status);
  const [etapas, { data: grupos }, { data }, { count: nConfirmar }, { count: nIgnorados }, { data: caixa }] = await Promise.all([
    etapasDaEmpresa(empresa.id, tId),
    supabase.from("grupos").select("id, nome").eq("org_id", empresa.id).eq("turma_id", tId).eq("ativo", true).order("nome"),
    supabase
      .from("emails_recebidos")
      .select("id, enviado_em, de_email, de_nome, assunto, texto, links, anexos, anexos_pendentes, status, motivo, avisos, etapa_sugerida, grupo_sugerido")
      .eq("org_id", empresa.id)
      .eq("turma_id", tId)
      .eq("status", STATUS_DA_ABA[aba])
      .order("recebido_em", { ascending: false })
      .limit(100),
    contar("confirmar"),
    contar("ignorado"),
    supabase.from("organizacoes").select("etiqueta_assunto").eq("id", empresa.id).maybeSingle(),
  ]);
  const endereco = turma ? enderecoDeRecebimento(turma.caixa_token) : null;
  const mensagem = turma && endereco ? await dadosDaMensagem(supabase, empresa, turma) : null;
  const emails = (data ?? []) as Email[];
  const contagem: Record<Aba, number> = { confirmar: nConfirmar ?? 0, ignorados: nIgnorados ?? 0 };
  const opcoesEtapa = etapas.map((e) => ({ id: e.id, nome: `${v.etapa} ${e.numero}` }));

  return (
    <section className="flex flex-col gap-4">
      <NavEntregas slug={slug} atual="caixa" paraConfirmar={nConfirmar ?? 0} />
      <p className="text-sm text-suave">E-mails que o Handback não conseguiu ligar sozinho a {v.grupos.toLowerCase()}. Confirme ou ignore.</p>

      {endereco ? (
        <Dobra titulo="Endereço para receber as entregas" extra="copiar e mandar para a turma">
          <EnderecoDaTurma endereco={endereco} dados={mensagem!} comTitulo={false} aoCopiar={marcarMensagemCopiada.bind(null, slug)} />
        </Dobra>
      ) : null}

      <nav aria-label="Filtrar e-mails" className="flex gap-1.5">
        {(Object.keys(ABAS) as Aba[]).map((a) => (
          <Link
            key={a}
            href={`/app/${slug}/entregas/caixa${a === "confirmar" ? "" : `?ver=${a}`}`}
            aria-current={a === aba ? "true" : undefined}
            className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-semibold ${
              a === aba ? "border-texto bg-texto text-fundo" : "border-borda bg-cartao text-suave hover:text-texto"
            }`}
          >
            {ABAS[a]} ({contagem[a]})
          </Link>
        ))}
      </nav>

      {!emails.length ? (
        <Vazio>{aba === "confirmar" ? "Tudo em dia. Nada para confirmar." : "Nenhum e-mail ignorado."}</Vazio>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {emails.map((m) => {
            const gmail = m.de_email === GMAIL;
            const sugeriu = Boolean(m.grupo_sugerido);
            return (
              <li key={m.id} className="flex flex-col gap-2.5 rounded-2xl border border-borda bg-cartao p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="break-words font-semibold">{gmail ? "Confirmação de encaminhamento do Gmail" : m.assunto || "(sem assunto)"}</span>
                  <span className="break-all text-xs text-suave">
                    {m.de_nome ? `${m.de_nome} · ` : ""}
                    {m.de_email} · {dataHoraBR(m.enviado_em)}
                  </span>
                </div>

                {m.anexos_pendentes?.length ? (
                  <p className="rounded-lg bg-neutro-fundo px-2 py-1 text-xs text-neutro">
                    Tinha {m.anexos_pendentes.length === 1 ? "1 anexo" : `${m.anexos_pendentes.length} anexos`} ({m.anexos_pendentes.map((x) => x.nome).join(", ")}) que
                    não {m.anexos_pendentes.length === 1 ? "foi guardado" : "foram guardados"}
                    {m.status === "ignorado" ? " (e-mail ignorado: por privacidade, o Handback não guarda)" : ""}. Se for entrega, o Handback busca de novo quando você confirmar.
                  </p>
                ) : null}
                {m.anexos.length || m.links.length ? (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Anexos e links">
                    {m.anexos.map((x, i) => (
                      <li key={i} className="inline-flex max-w-full items-center gap-1 rounded-lg bg-neutro-fundo px-2 py-1 text-xs text-neutro">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
                          <path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7" />
                        </svg>
                        <span className="truncate">{x.nome}</span>
                        <span className="shrink-0 opacity-75">{tamanhoLegivel(x.tamanho)}</span>
                      </li>
                    ))}
                    {!gmail && m.links.length ? (
                      <li className="rounded-lg bg-neutro-fundo px-2 py-1 text-xs text-neutro">{m.links.length} link(s)</li>
                    ) : null}
                  </ul>
                ) : null}

                {gmail ? (
                  <p className="rounded-[10px] bg-neutro-fundo px-2.5 py-2 text-[13px] leading-snug text-neutro">
                    O Gmail pede para confirmar o encaminhamento. Abra o link (ou copie o código abaixo no Gmail) uma vez para liberar.
                  </p>
                ) : (
                  <p
                    className={`rounded-[10px] px-2.5 py-2 text-[13px] leading-snug ${
                      sugeriu ? "bg-marca-clara text-marca-forte" : "bg-neutro-fundo text-neutro"
                    }`}
                  >
                    {sugeriu
                      ? `Parece de ${(grupos ?? []).find((g) => g.id === m.grupo_sugerido)?.nome ?? "uma equipe"} (${m.motivo}). Confira e confirme.`
                      : `Motivo: ${m.motivo}.`}
                  </p>
                )}
                {!gmail && m.avisos.length ? (
                  <ul className="list-disc pl-5 text-[13px] text-alerta">
                    {m.avisos.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                ) : null}

                <details className="text-sm" open={gmail}>
                  <summary className="cursor-pointer text-[13px] font-medium text-marca-forte">Ver o texto do e-mail</summary>
                  <div className="mt-2 max-h-64 overflow-auto whitespace-pre-line break-words rounded-lg bg-fundo p-3">
                    {m.texto || "(vazio)"}
                    {m.links.length ? "\n\nLinks:\n" + m.links.join("\n") : ""}
                  </div>
                </details>

                <DecisaoEmail
                  slug={slug}
                  emailId={m.id}
                  etapas={opcoesEtapa}
                  grupos={grupos ?? []}
                  etapaSugerida={m.etapa_sugerida}
                  grupoSugerido={m.grupo_sugerido}
                  rotuloEtapa={v.etapa}
                  rotuloGrupo={v.grupo}
                  podeIgnorar={m.status !== "ignorado"}
                  gmail={gmail && m.status !== "ignorado"}
                  linkGmail={m.links.find((l) => /google\.com/.test(l)) ?? null}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

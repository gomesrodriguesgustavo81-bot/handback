import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoConfirmar, FormAcao } from "@/components/form-acao";
import { Selo, Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR, tamanhoLegivel } from "@/lib/textos";
import { ignorarEmail, importarEmail } from "../acoes";
import { etapasDaEmpresa } from "../dados";

export const metadata: Metadata = { title: "Caixa de e-mails" };

const FILTROS = {
  confirmar: { nome: "Para confirmar", status: ["confirmar"] },
  ignorados: { nome: "Ignorados", status: ["ignorado"] },
  todos: { nome: "Todos", status: ["entrega", "confirmar", "ignorado", "importado"] },
} as const;
type Filtro = keyof typeof FILTROS;

const ROTULO_STATUS: Record<string, string> = {
  entrega: "Virou entrega",
  importado: "Confirmado como entrega",
  confirmar: "Para confirmar",
  ignorado: "Ignorado",
};

type Email = {
  id: string;
  recebido_em: string;
  enviado_em: string;
  de_email: string;
  de_nome: string;
  assunto: string;
  texto: string;
  links: string[];
  anexos: { nome: string; tamanho: number }[];
  status: string;
  motivo: string;
  avisos: string[];
  etapa_sugerida: string | null;
  grupo_sugerido: string | null;
  entrega_id: string | null;
};

export default async function CaixaDeEmails({ params, searchParams }: PageProps<"/app/[slug]/entregas/caixa">) {
  const { slug } = await params;
  const { ver } = await searchParams;
  const filtro: Filtro = typeof ver === "string" && ver in FILTROS ? (ver as Filtro) : "confirmar";
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) notFound();
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();

  const [etapas, { data: grupos }, { data }] = await Promise.all([
    etapasDaEmpresa(empresa.id),
    supabase.from("grupos").select("id, nome").eq("org_id", empresa.id).eq("ativo", true).order("nome"),
    supabase
      .from("emails_recebidos")
      .select("id, recebido_em, enviado_em, de_email, de_nome, assunto, texto, links, anexos, status, motivo, avisos, etapa_sugerida, grupo_sugerido, entrega_id")
      .eq("org_id", empresa.id)
      .in("status", [...FILTROS[filtro].status])
      .order("recebido_em", { ascending: false })
      .limit(100),
  ]);
  const emails = (data ?? []) as Email[];

  return (
    <section className="flex flex-col gap-4">
      <Link href={`/app/${slug}/entregas`} className="text-sm text-suave hover:text-texto">
        ← Entregas
      </Link>
      <div>
        <h2 className="text-lg font-semibold">Caixa de e-mails</h2>
        <p className="text-sm text-suave">Tudo o que chegou pelo encaminhamento e o que o Handback decidiu.</p>
      </div>

      <nav aria-label="Filtrar e-mails" className="flex flex-wrap gap-2">
        {(Object.keys(FILTROS) as Filtro[]).map((f) => (
          <Link
            key={f}
            href={`/app/${slug}/entregas/caixa?ver=${f}`}
            aria-current={f === filtro ? "true" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${
              f === filtro ? "border-marca bg-marca-clara font-medium text-marca-forte" : "border-borda bg-cartao"
            }`}
          >
            {FILTROS[f].nome}
          </Link>
        ))}
      </nav>

      {!emails.length ? (
        <Vazio>{filtro === "confirmar" ? "Nada para confirmar. 🎉" : "Nenhum e-mail aqui."}</Vazio>
      ) : (
        <ul className="flex flex-col gap-3">
          {emails.map((m) => (
            <li key={m.id} className="flex flex-col gap-3 rounded-2xl border border-borda bg-cartao p-4">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="break-words font-semibold">{m.assunto || "(sem assunto)"}</span>
                  <Selo>{ROTULO_STATUS[m.status] ?? m.status}</Selo>
                </div>
                <p className="break-all text-sm text-suave">
                  {m.de_nome ? `${m.de_nome} · ` : ""}
                  {m.de_email} · {dataHoraBR(m.enviado_em)}
                </p>
                <p className="text-sm">
                  <span className="text-suave">Motivo:</span> {m.motivo}
                </p>
                {m.avisos.length ? (
                  <ul className="list-disc pl-5 text-sm text-alerta">
                    {m.avisos.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="text-sm text-suave">
                  {m.anexos.length
                    ? m.anexos.map((a) => `${a.nome} (${tamanhoLegivel(a.tamanho)})`).join(", ")
                    : "Sem anexos guardados"}
                  {m.links.length ? ` · ${m.links.length} link(s)` : ""}
                </p>
                <details className="text-sm" open={m.de_email === "forwarding-noreply@google.com" && m.status === "confirmar"}>
                  <summary className="cursor-pointer text-marca-forte">Ver o texto do e-mail</summary>
                  <div className="mt-2 max-h-64 overflow-auto whitespace-pre-line break-words rounded-lg bg-fundo p-3">
                    {m.texto || "(vazio)"}
                    {m.links.length ? "\n\nLinks:\n" + m.links.join("\n") : ""}
                  </div>
                </details>
              </div>

              {m.de_email === "forwarding-noreply@google.com" && m.status !== "ignorado" ? (
                <div className="flex flex-col gap-2 border-t border-borda pt-3">
                  <p className="text-sm">
                    Abra “Ver o texto do e-mail”, copie o <strong>código de confirmação</strong> e cole no Gmail (ou abra o link).
                    Depois, toque abaixo para tirar este aviso da lista.
                  </p>
                  <div className="flex justify-end">
                    <BotaoConfirmar acao={ignorarEmail.bind(null, slug, m.id)} pergunta="Já confirmou o encaminhamento no Gmail?">
                      Já confirmei no Gmail
                    </BotaoConfirmar>
                  </div>
                </div>
              ) : m.entrega_id ? (
                <Link href={`/app/${slug}/entregas/${m.entrega_id}`} className="text-sm font-medium text-marca-forte hover:underline">
                  Abrir a entrega →
                </Link>
              ) : (
                <div className="flex flex-col gap-3 border-t border-borda pt-3">
                  <FormAcao acao={importarEmail.bind(null, slug, m.id)} textoBotao="Confirmar como entrega" textoEnviando="Confirmando…">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium">{v.etapa}</span>
                        <select
                          name="etapa"
                          aria-label={v.etapa}
                          required
                          defaultValue={m.etapa_sugerida ?? ""}
                          className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
                        >
                          <option value="" disabled>
                            Escolha…
                          </option>
                          {etapas.map((e) => (
                            <option key={e.id} value={e.id}>
                              {v.etapa} {e.numero} · {e.titulo}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium">{v.grupo}</span>
                        <select
                          name="grupo"
                          aria-label={v.grupo}
                          required
                          defaultValue={m.grupo_sugerido ?? ""}
                          className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
                        >
                          <option value="" disabled>
                            Escolha…
                          </option>
                          {(grupos ?? []).map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </FormAcao>
                  {m.status !== "ignorado" ? (
                    <div className="flex justify-end">
                      <BotaoConfirmar acao={ignorarEmail.bind(null, slug, m.id)} pergunta="Marcar este e-mail como “não é entrega”?">
                        Não é entrega
                      </BotaoConfirmar>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

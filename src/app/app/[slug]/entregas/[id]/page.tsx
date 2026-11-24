import type { Metadata } from "next";
import { BuscarAnexos } from "./buscar-anexos";
import { parecidasDe } from "@/lib/parecidas";
import { IconeDrive, pastaDaEquipeNoDrive } from "@/lib/pastas-drive";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotaoAnalisar, FolhaDevolutiva } from "@/components/analise";
import { Bloco, Dobra, IconeItem, PilulaAtraso, SeloConceito, type StatusItem } from "@/components/conceito";
import { Aviso } from "@/components/ui";
import { AvisoGmail } from "@/components/aviso-gmail";
import { meuGmail } from "@/lib/envio";
import { registrarDocumento } from "@/lib/registro";
import { gmailConfigurado } from "@/lib/gmail";
import { notaDoConceito } from "@/lib/moodle/cliente";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR, passouMaisDe, tamanhoLegivel } from "@/lib/textos";

export const metadata: Metadata = { title: "Folha da equipe" };
// A análise com IA roda a partir desta página e pode levar alguns minutos.
export const maxDuration = 300;

type Entrega = {
  id: string;
  etapa_id: string;
  grupo_id: string;
  enviada_em: string;
  origem: "email" | "manual" | "moodle";
  remetente: string;
  assunto: string;
  atrasada: boolean;
  status: "recebida" | "substituida";
  comentario: string;
  links: string[];
  etapas: { numero: number; titulo: string; moodle_tarefa: number | null; moodle_nota_max: number | null } | null;
  grupos: { nome: string; tema: string } | null;
  arquivos_entrega: { id: string; caminho: string; nome: string; tamanho: number }[];
  emails_recebidos: { avisos: string[]; anexos_pendentes: { nome: string }[]; origem_id: string | null } | null;
};

type Analise = {
  status: "analisando" | "pronta" | "erro" | "aprovada";
  iniciada_em: string;
  concluida_em: string | null;
  modelo: string;
  segundos: number | null;
  checklist: { item: string; status: StatusItem; evidencia: string }[];
  conceito_ia: string | null;
  justificativa: string;
  analise_interna: string;
  motivo_mudanca: string;
  envio_status: "enviando" | "enviada" | "erro" | null;
  enviada_em: string | null;
  enviada_para: string[];
  envio_erro: string;
  evolucao: string;
  arquivos_lidos: string[];
  avisos_leitura: string[];
  erro: string;
  conceito: string | null;
  devolutiva: string;
  aprovada_em: string | null;
  atualizada_em: string;
  moodle_status: "enviando" | "enviada" | "erro" | null;
  moodle_enviada_em: string | null;
  moodle_nota: number | null;
  moodle_erro: string;
};

export default async function FolhaDaEquipe({ params, searchParams }: PageProps<"/app/[slug]/entregas/[id]">) {
  const { slug, id } = await params;
  const { gmail: avisoGmail } = await searchParams;
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();

  // O banco só devolve a entrega para quem avalia nesta empresa.
  const { data } = await supabase
    .from("entregas")
    .select(
      "id, etapa_id, grupo_id, enviada_em, origem, remetente, assunto, atrasada, status, comentario, links, etapas(numero, titulo, moodle_tarefa, moodle_nota_max), grupos(nome, tema), arquivos_entrega(id, caminho, nome, tamanho), emails_recebidos!entregas_email_id_fkey(avisos, anexos_pendentes, origem_id)",
    )
    .eq("org_id", empresa.id)
    .eq("id", id)
    .maybeSingle();
  const entrega = data as Entrega | null;
  if (!entrega) notFound();
  const [pastaDrive, parecidas] = await Promise.all([pastaDaEquipeNoDrive(supabase, entrega.grupo_id), parecidasDe(supabase, entrega.id)]);

  const [{ data: analiseBruta }, { data: daEtapa }, { data: doGrupo }, gmail, { data: destinos }, { data: org }] = await Promise.all([
    supabase.from("analises").select("*").eq("entrega_id", entrega.id).maybeSingle(),
    // Outras equipes desta etapa (para as setas ‹ ›) e envios anteriores desta equipe.
    supabase
      .from("entregas")
      .select("id, grupo_id, enviada_em, status, atrasada, grupos(nome)")
      .eq("etapa_id", entrega.etapa_id)
      .order("enviada_em", { ascending: false }),
    // Conceitos da equipe nas outras etapas.
    supabase
      .from("entregas")
      .select("id, etapas(numero, titulo), analises(status, conceito)")
      .eq("grupo_id", entrega.grupo_id)
      .eq("status", "recebida"),
    meuGmail(supabase),
    supabase.rpc("destinatarios_da_entrega", { p_entrega: entrega.id }).maybeSingle<{ para: string[]; copia: string[] }>(),
    supabase.from("organizacoes").select("notas_moodle").eq("id", empresa.id).single(),
  ]);
  const a = analiseBruta as Analise | null;

  type DaEtapa = { id: string; grupo_id: string; enviada_em: string; status: string; atrasada: boolean; grupos: { nome: string } | null };
  const linhasEtapa = (daEtapa ?? []) as unknown as DaEtapa[];
  const equipes = linhasEtapa
    .filter((x) => x.status === "recebida")
    .sort((x, y) => (x.grupos?.nome ?? "").localeCompare(y.grupos?.nome ?? "", "pt-BR"));
  const pos = equipes.findIndex((x) => x.id === entrega.id);
  const anterior = pos > 0 ? equipes[pos - 1] : null;
  const proxima = pos >= 0 && pos < equipes.length - 1 ? equipes[pos + 1] : null;
  const envios = linhasEtapa.filter((x) => x.grupo_id === entrega.grupo_id);
  const valendo = envios.find((x) => x.status === "recebida");

  type DoGrupo = { id: string; etapas: { numero: number; titulo: string } | null; analises: { status: string; conceito: string | null } | null };
  const historico = ((doGrupo ?? []) as unknown as DoGrupo[])
    .filter((x) => x.etapas)
    .sort((x, y) => x.etapas!.numero - y.etapas!.numero);

  const base = `/app/${slug}/entregas`;
  const painel = `${base}?etapa=${entrega.etapa_id}`;
  const substituida = entrega.status === "substituida";
  const travada = a?.status === "analisando" && passouMaisDe(a.iniciada_em, 5);
  const temResultado = a && (a.status === "pronta" || a.status === "aprovada");
  const nome = entrega.grupos?.nome ?? v.grupo;
  // Registro: quem abriu esta entrega (os documentos dela).
  await registrarDocumento(
    supabase,
    empresa.id,
    "abriu_entrega",
    `Abriu a entrega de ${nome} · ${v.etapa} ${entrega.etapas?.numero ?? "?"}`,
    entrega.id,
  );

  // Situação de leitura de cada arquivo e link (o que a IA leu ou não conseguiu ler).
  const leitura = (alvo: string) => {
    if (!temResultado) return null;
    if (a.arquivos_lidos.some((l) => l === alvo || l.endsWith(alvo))) return { ok: true, texto: "Lido pela IA" };
    const aviso = a.avisos_leitura.find((x) => x.includes(alvo));
    if (!aviso) return { ok: false, texto: "Não lido pela IA" };
    if (/^Sem acesso/.test(aviso)) return { ok: false, texto: "Sem acesso: peça para compartilhar como “qualquer pessoa com o link”" };
    if (/^Link externo/.test(aviso)) return { ok: false, texto: "Não lido pela IA (só o endereço foi considerado)" };
    return { ok: false, texto: aviso.replace(`"${alvo}"`, "").replace(/\s+/g, " ").trim() };
  };

  const setas = (
    <div className="flex items-center">
      <Seta href={anterior ? `${base}/${anterior.id}` : null} rotulo="Anterior" caminho="M15 6l-6 6 6 6" />
      <span className="min-w-12 text-center text-[13px] text-suave">{pos >= 0 ? `${pos + 1} de ${equipes.length}` : ""}</span>
      <Seta href={proxima ? `${base}/${proxima.id}` : null} rotulo="Seguinte" caminho="M9 6l6 6-6 6" />
    </div>
  );

  const checklist = temResultado ? (
    <Bloco
      titulo="O que foi pedido"
      rotulo="Checklist"
      extra={`${a.checklist.filter((c) => c.status === "ENTREGUE").length} de ${a.checklist.length} entregues`}
    >
      <ul className="flex flex-col">
        {a.checklist.map((c, i) => (
          <li key={i} className="flex items-start gap-2.5 py-1.5">
            <IconeItem status={c.status} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="break-words text-sm font-semibold">{c.item}</span>
              {c.evidencia ? <span className="break-words text-xs leading-snug text-suave">{c.evidencia}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </Bloco>
  ) : null;

  // Anexos que o e-mail tinha mas não chegaram (o motivo vem do recebimento).
  const pendentes = entrega.emails_recebidos?.anexos_pendentes ?? [];
  // Depois que os anexos voltam, o aviso some (e-mails antigos, sem como buscar de novo, continuam mostrando).
  const resolvido = !pendentes.length && Boolean(entrega.emails_recebidos?.origem_id);
  const problemasAnexo = resolvido ? [] : (entrega.emails_recebidos?.avisos ?? []).filter((x) => /anexo/i.test(x));
  const podeBuscarDeNovo = pendentes.length > 0 && Boolean(entrega.emails_recebidos?.origem_id);
  const arquivos = (
    <Bloco titulo="Arquivos da entrega">
      {problemasAnexo.length ? (
        <div role="alert" className="mb-2 flex flex-col gap-2 rounded-xl bg-alerta-fundo px-3 py-2 text-sm text-alerta">
          <ul className="flex flex-col gap-1">
            {problemasAnexo.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
          {podeBuscarDeNovo ? <BuscarAnexos slug={slug} entregaId={entrega.id} /> : null}
        </div>
      ) : null}
      {pastaDrive ? (
        <a
          href={pastaDrive}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-borda px-3 text-sm font-semibold text-marca-forte hover:bg-fundo"
        >
          <IconeDrive /> Abrir a pasta da equipe no Google Drive
        </a>
      ) : null}
      {!entrega.arquivos_entrega.length && !entrega.links.length ? (
        <p className="text-sm text-suave">Nenhum arquivo nem link{entrega.comentario ? " (só o texto do e-mail)" : ""}.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entrega.arquivos_entrega.map((f) => (
            <LinhaArquivo
              key={f.id}
              href={`${base}/${entrega.id}/arquivo/${f.id}`}
              nome={f.nome}
              detalhe={tamanhoLegivel(f.tamanho)}
              leitura={leitura(f.nome)}
            />
          ))}
          {entrega.links.map((l) => (
            <LinhaArquivo key={l} href={l} nome={l.replace(/^https?:\/\//, "")} detalhe="link" leitura={leitura(l)} link />
          ))}
        </ul>
      )}
    </Bloco>
  );

  const detalhes = (
    <>
      {temResultado ? (
        <Dobra titulo="Análise interna" extra="só quem avalia vê">
          {a.justificativa ? (
            <div>
              <p className="font-semibold">Por que {a.conceito_ia}</p>
              <p className="whitespace-pre-line text-suave">{a.justificativa}</p>
            </div>
          ) : null}
          <p className="whitespace-pre-line leading-relaxed">{a.analise_interna || "—"}</p>
        </Dobra>
      ) : null}

      <Dobra titulo="Histórico de entregas" extra={temResultado ? a.evolucao : undefined}>
        {historico.length ? (
          <ul className="flex flex-col gap-2">
            {historico.map((h) => {
              const conc = h.analises && ["pronta", "aprovada"].includes(h.analises.status) ? h.analises.conceito : null;
              return (
                <li key={h.id} className="flex items-center justify-between gap-2">
                  <span className={h.id === valendo?.id ? "font-semibold" : ""}>
                    {v.etapa} {h.etapas!.numero} · {h.etapas!.titulo}
                    {h.id === valendo?.id ? " (esta)" : ""}
                  </span>
                  <SeloConceito conceito={conc} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-suave">Primeira entrega.</p>
        )}
      </Dobra>

      <Dobra titulo={entrega.origem === "email" ? "E-mail recebido" : entrega.origem === "moodle" ? "Enviada no Moodle" : "Registro à mão"}>
        <p className="break-words text-xs text-suave">
          {entrega.origem === "email" ? "De" : "Por"}: {entrega.remetente || "—"} · {dataHoraBR(entrega.enviada_em)}
        </p>
        {entrega.origem === "email" ? <p className="break-words font-semibold">{entrega.assunto || "(sem assunto)"}</p> : null}
        <p className="max-h-72 overflow-auto whitespace-pre-line break-words leading-relaxed">{entrega.comentario || "(sem texto)"}</p>
      </Dobra>

      <Dobra titulo="Detalhes da análise">
        {temResultado ? (
          <p className="text-suave">
            Leu: {a.arquivos_lidos.join("; ") || "só o texto"} · {a.modelo}
            {a.segundos ? ` · ${a.segundos}s` : ""}
          </p>
        ) : null}
        {temResultado && a.avisos_leitura.length ? (
          <ul className="list-disc pl-4 text-alerta">
            {a.avisos_leitura.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        ) : null}
        {temResultado && a.erro ? <Aviso tipo="alerta">A última reanálise falhou ({a.erro}); este é o resultado anterior.</Aviso> : null}
        {temResultado && a.status !== "aprovada" && !substituida ? (
          <>
            <p className="text-suave">Analisar de novo troca o conceito e a devolutiva pelos novos (edições não aprovadas se perdem).</p>
            <BotaoAnalisar slug={slug} entregaId={entrega.id} texto="Analisar de novo" variante="secundario" />
          </>
        ) : null}
        {envios.length > 1 ? (
          <div>
            <p className="font-semibold">Todos os envios desta entrega</p>
            <ul className="mt-1 flex flex-col gap-1">
              {envios.map((h) => (
                <li key={h.id}>
                  {h.id === entrega.id ? (
                    <strong>{dataHoraBR(h.enviada_em)} (este)</strong>
                  ) : (
                    <Link href={`${base}/${h.id}`} className="text-marca-forte hover:underline">
                      {dataHoraBR(h.enviada_em)}
                    </Link>
                  )}{" "}
                  <span className="text-suave">
                    · {h.status === "recebida" ? "valendo" : "substituído"}
                    {h.atrasada ? " · com atraso" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Dobra>
    </>
  );

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Link href={painel} className="-ml-1.5 inline-flex min-h-11 items-center gap-0.5 px-1.5 font-semibold text-marca-forte hover:underline">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Painel
          </Link>
          {!substituida ? setas : null}
        </div>
        <h1 className="break-words text-2xl font-bold tracking-tight">{nome}</h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-suave">
          <span>
            {v.etapa} {entrega.etapas?.numero} · {entrega.origem === "manual" ? "registrada" : "recebida"} {dataHoraBR(entrega.enviada_em)}{" "}
            {entrega.origem === "email" ? "por e-mail" : entrega.origem === "moodle" ? "pelo Moodle" : "à mão"}
          </span>
          <PilulaAtraso atrasada={entrega.atrasada} />
        </div>
      </header>

      <AvisoGmail aviso={avisoGmail} />
      {parecidas.length ? (
        <section role="note" aria-label="Parecida com outras entregas" className="flex flex-col gap-1 rounded-2xl bg-alerta-fundo px-4 py-3 text-sm text-alerta">
          <strong>Parecida demais com outra entrega desta aula</strong>
          {parecidas.map((p) => (
            <span key={p.entregaId}>
              <Link href={`${base}/${p.entregaId}`} className="font-semibold underline">
                {p.grupo}
              </Link>{" "}
              · {p.motivo === "mandou o mesmo arquivo" ? "mandou o mesmo arquivo" : `${p.percentual}% do texto igual`}
            </span>
          ))}
          <span className="text-xs">É só um aviso: confira as duas antes de decidir. Trechos comuns, como o enunciado copiado, também contam.</span>
        </section>
      ) : null}
      {substituida ? (
        <Aviso tipo="alerta">
          Substituída por um reenvio.{" "}
          {valendo ? (
            <Link href={`${base}/${valendo.id}`} className="font-semibold underline">
              Abrir a entrega que vale
            </Link>
          ) : null}
        </Aviso>
      ) : null}

      {temResultado ? (
        <FolhaDevolutiva
          key={`${a.status}-${a.concluida_em}`}
          slug={slug}
          entregaId={entrega.id}
          conceito={a.conceito ?? a.conceito_ia ?? "PENDENTE"}
          conceitoIa={a.conceito_ia}
          devolutiva={a.devolutiva}
          aprovada={a.status === "aprovada"}
          aprovadaEm={a.aprovada_em ? dataHoraBR(a.aprovada_em) : ""}
          destinatario={nome}
          proxima={proxima ? `${base}/${proxima.id}` : null}
          painel={painel}
          envio={{
            enviada: Boolean(a.enviada_em),
            em: a.enviada_em ? dataHoraBR(a.enviada_em) : "",
            para: a.enviada_para ?? [],
            erro: a.envio_status === "erro" || (a.envio_status === "enviada" && a.envio_erro) ? a.envio_erro : "",
          }}
          gmail={{ configurado: gmailConfigurado(), email: gmail && !gmail.invalida ? gmail.email : null }}
          destinos={destinos ?? { para: [], copia: [] }}
          motivo={a.motivo_mudanca ?? ""}
          conectarHref={`/api/gmail/conectar?voltar=${encodeURIComponent(`${base}/${entrega.id}`)}`}
          moodle={
            entrega.etapas?.moodle_tarefa
              ? {
                  enviada: Boolean(a.moodle_enviada_em),
                  em: a.moodle_enviada_em ? dataHoraBR(a.moodle_enviada_em) : "",
                  nota: a.moodle_nota === null ? null : String(a.moodle_nota).replace(".", ","),
                  erro: a.moodle_status === "erro" || (a.moodle_status === "enviada" && a.moodle_erro) ? a.moodle_erro : "",
                  notaPrevista: (() => {
                    const n = notaDoConceito(entrega.etapas?.moodle_nota_max, (org?.notas_moodle as Record<string, number> | null)?.[a.conceito ?? ""]);
                    return n === null ? null : `${String(n).replace(".", ",")} (de ${String(entrega.etapas?.moodle_nota_max).replace(".", ",")})`;
                  })(),
                }
              : null
          }
        >
          {checklist}
          {arquivos}
          {detalhes}
        </FolhaDevolutiva>
      ) : (
        <>
          <Bloco titulo="Conceito e devolutiva">
            {a?.status === "analisando" && !travada ? (
              <Aviso>A IA está analisando esta entrega (começou às {dataHoraBR(a.iniciada_em).split(" às ")[1]}). Atualize a página daqui a pouco.</Aviso>
            ) : (
              <>
                {a?.erro ? <Aviso tipo="erro">A última análise falhou: {a.erro}</Aviso> : null}
                {substituida ? (
                  <p className="text-sm text-suave">Esta entrega foi substituída: analise a mais recente.</p>
                ) : (
                  <>
                    <p className="text-sm text-suave">
                      A IA confere o checklist, sugere o conceito e escreve um rascunho de devolutiva. Nada é enviado sem a sua aprovação.
                    </p>
                    <BotaoAnalisar slug={slug} entregaId={entrega.id} texto={a ? "Tentar de novo" : "Analisar com IA"} />
                  </>
                )}
              </>
            )}
          </Bloco>
          {arquivos}
          {detalhes}
        </>
      )}
    </section>
  );
}

function Seta({ href, rotulo, caminho }: { href: string | null; rotulo: string; caminho: string }) {
  const icone = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={caminho} />
    </svg>
  );
  return href ? (
    <Link href={href} aria-label={rotulo} className="flex size-11 items-center justify-center rounded-xl hover:bg-neutro-fundo">
      {icone}
    </Link>
  ) : (
    <span aria-hidden className="flex size-11 items-center justify-center text-borda">
      {icone}
    </span>
  );
}

function LinhaArquivo({
  href,
  nome,
  detalhe,
  leitura,
  link = false,
}: {
  href: string;
  nome: string;
  detalhe: string;
  leitura: { ok: boolean; texto: string } | null;
  link?: boolean;
}) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel={link ? "noopener noreferrer nofollow" : "noopener noreferrer"}
        className="-mx-2 flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-fundo"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-neutro-fundo text-neutro">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {link ? (
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            ) : (
              <>
                <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                <path d="M14 3v5h5" />
              </>
            )}
          </svg>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-texto">{nome}</span>
          <span className={`text-xs ${!leitura ? "text-suave" : leitura.ok ? "text-marca-forte" : "font-semibold text-alerta"}`}>
            {leitura ? leitura.texto : detalhe}
          </span>
        </span>
        <span className="shrink-0 rounded-[10px] border border-borda px-3 py-2 text-[13px] font-semibold text-texto">Abrir</span>
      </a>
    </li>
  );
}

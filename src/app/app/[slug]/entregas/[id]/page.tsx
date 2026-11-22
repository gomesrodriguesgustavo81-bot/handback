import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cartao, Selo } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataBR, dataHoraBR, tamanhoLegivel } from "@/lib/textos";

export const metadata: Metadata = { title: "Entrega" };

type Entrega = {
  id: string;
  etapa_id: string;
  grupo_id: string;
  enviada_em: string;
  enviada_por_email: string;
  registrada_pela_equipe: boolean;
  atrasada: boolean;
  status: "recebida" | "substituida";
  comentario: string;
  links: string[];
  etapas: { numero: number; titulo: string; recebe_ate: string | null } | null;
  grupos: { nome: string } | null;
  arquivos_entrega: { id: string; caminho: string; nome: string; tamanho: number }[];
};

export default async function DetalheEntrega({ params }: PageProps<"/app/[slug]/entregas/[id]">) {
  const { slug, id } = await params;
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();

  // O banco só devolve a entrega para quem avalia ou para a própria equipe.
  const { data } = await supabase
    .from("entregas")
    .select(
      "id, etapa_id, grupo_id, enviada_em, enviada_por_email, registrada_pela_equipe, atrasada, status, comentario, links, etapas(numero, titulo, recebe_ate), grupos(nome), arquivos_entrega(id, caminho, nome, tamanho)",
    )
    .eq("org_id", empresa.id)
    .eq("id", id)
    .maybeSingle();
  const entrega = data as Entrega | null;
  if (!entrega) notFound();

  // Links temporários (1 hora) para baixar os arquivos da área privada.
  const caminhos = entrega.arquivos_entrega.map((a) => a.caminho);
  const assinados = caminhos.length
    ? (await supabase.storage.from("entregas").createSignedUrls(caminhos, 3600)).data ?? []
    : [];
  const urlDe = new Map(assinados.map((s) => [s.path, s.signedUrl]));

  const { data: historico } = await supabase
    .from("entregas")
    .select("id, enviada_em, status, atrasada")
    .eq("etapa_id", entrega.etapa_id)
    .eq("grupo_id", entrega.grupo_id)
    .order("enviada_em", { ascending: false });

  const voltar = podeAvaliar ? `/app/${slug}/entregas?etapa=${entrega.etapa_id}` : `/app/${slug}/entregar`;

  return (
    <section className="flex flex-col gap-4">
      <Link href={voltar} className="text-sm text-suave hover:text-texto">
        ← {podeAvaliar ? "Entregas" : "Minhas entregas"}
      </Link>

      <Cartao className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">
            {entrega.grupos?.nome} · {v.etapa} {entrega.etapas?.numero}
          </h2>
          <p className="text-sm text-suave">{entrega.etapas?.titulo}</p>
          <div className="flex flex-wrap gap-2">
            {entrega.status === "substituida" ? <Selo>Substituída por um reenvio</Selo> : <Selo>Valendo</Selo>}
            {entrega.atrasada ? <Selo>Com atraso</Selo> : null}
            {!entrega.registrada_pela_equipe ? <Selo>Registrada por quem avalia</Selo> : null}
          </div>
        </div>

        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-suave">Enviada</dt>
            <dd>
              {dataHoraBR(entrega.enviada_em)} por <span className="break-all">{entrega.enviada_por_email}</span>
              {entrega.etapas?.recebe_ate ? ` · prazo: ${dataBR(entrega.etapas.recebe_ate)}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-suave">Arquivos</dt>
            <dd>
              {entrega.arquivos_entrega.length ? (
                <ul className="mt-1 flex flex-col gap-1">
                  {entrega.arquivos_entrega.map((a) => (
                    <li key={a.id}>
                      <a
                        href={urlDe.get(a.caminho) ?? "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-marca-forte hover:underline"
                      >
                        {a.nome}
                      </a>{" "}
                      <span className="text-suave">· {tamanhoLegivel(a.tamanho)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                "Nenhum arquivo"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-suave">Links</dt>
            <dd>
              {entrega.links.length ? (
                <ul className="mt-1 flex flex-col gap-1">
                  {entrega.links.map((l) => (
                    <li key={l}>
                      <a href={l} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-marca-forte hover:underline">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                "Nenhum link"
              )}
            </dd>
          </div>
          {entrega.comentario ? (
            <div>
              <dt className="text-suave">Comentário</dt>
              <dd className="whitespace-pre-line">{entrega.comentario}</dd>
            </div>
          ) : null}
        </dl>
      </Cartao>

      {historico && historico.length > 1 ? (
        <Cartao>
          <h3 className="font-semibold">Histórico de envios</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {historico.map((h) => (
              <li key={h.id}>
                {h.id === entrega.id ? (
                  <strong>{dataHoraBR(h.enviada_em)} (esta)</strong>
                ) : (
                  <Link href={`/app/${slug}/entregas/${h.id}`} className="text-marca-forte hover:underline">
                    {dataHoraBR(h.enviada_em)}
                  </Link>
                )}{" "}
                <span className="text-suave">
                  · {h.status === "recebida" ? "valendo" : "substituída"}
                  {h.atrasada ? " · com atraso" : ""}
                </span>
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}
    </section>
  );
}

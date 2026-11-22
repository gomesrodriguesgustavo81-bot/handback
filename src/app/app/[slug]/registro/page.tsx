import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pilula } from "@/components/conceito";
import { Vazio } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR } from "@/lib/textos";
import { FILTROS_REGISTRO, lerFiltro, ROTULO_TIPO, type FiltroRegistro } from "./tipos";

export const metadata: Metadata = { title: "Registro de atividades" };

const POR_PAGINA = 50;

type Linha = { id: number; email: string; tipo: string; acao: string; descricao: string; ip: string; aparelho: string; criado_em: string };

export default async function Registro({ params, searchParams }: PageProps<"/app/[slug]/registro">) {
  const { slug } = await params;
  const { ver, pessoa, antes } = await searchParams;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const filtro = lerFiltro(ver);
  const quem = typeof pessoa === "string" ? pessoa.trim().toLowerCase().slice(0, 320) : "";
  const supabase = await criarClienteServidor();

  let consulta = supabase
    .from("atividades")
    .select("id, email, tipo, acao, descricao, ip, aparelho, criado_em")
    .eq("org_id", empresa.id)
    .order("id", { ascending: false })
    .limit(POR_PAGINA + 1);
  const tipos = FILTROS_REGISTRO[filtro].tipos;
  if (tipos.length) consulta = consulta.in("tipo", tipos);
  if (quem) consulta = consulta.ilike("email", `%${quem.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
  if (typeof antes === "string" && /^\d+$/.test(antes)) consulta = consulta.lt("id", Number(antes));
  const { data } = await consulta;
  const linhas = ((data ?? []) as Linha[]).slice(0, POR_PAGINA);
  const temMais = (data?.length ?? 0) > POR_PAGINA;

  const base = `/app/${slug}/registro`;
  const busca = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ ...(filtro !== "todos" ? { ver: filtro } : {}), ...(quem ? { pessoa: quem } : {}), ...extra });
    const t = p.toString();
    return t ? `${base}?${t}` : base;
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Registro de atividades</h2>
          <p className="text-sm text-suave">Quem fez o quê e quando. Ninguém consegue apagar ou alterar este registro.</p>
        </div>
        <a
          href={`${base}/planilha${filtro !== "todos" || quem ? `?${new URLSearchParams({ ...(filtro !== "todos" ? { ver: filtro } : {}), ...(quem ? { pessoa: quem } : {}) })}` : ""}`}
          className="inline-flex min-h-11 items-center rounded-xl border border-borda bg-cartao px-4 text-sm font-medium hover:bg-fundo"
        >
          Baixar planilha
        </a>
      </div>

      <nav aria-label="Filtrar registro" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1.5">
          {(Object.keys(FILTROS_REGISTRO) as FiltroRegistro[]).map((f) => (
            <li key={f}>
              <Link
                href={`${base}?${new URLSearchParams({ ...(f !== "todos" ? { ver: f } : {}), ...(quem ? { pessoa: quem } : {}) })}`}
                aria-current={f === filtro ? "true" : undefined}
                className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-semibold ${
                  f === filtro ? "border-texto bg-texto text-fundo" : "border-borda bg-cartao text-suave hover:text-texto"
                }`}
              >
                {FILTROS_REGISTRO[f].nome}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form action={base} className="flex gap-2">
        {filtro !== "todos" ? <input type="hidden" name="ver" value={filtro} /> : null}
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="sr-only">Filtrar por pessoa</span>
          <input
            name="pessoa"
            defaultValue={quem}
            placeholder="Filtrar por e-mail da pessoa"
            className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
          />
        </label>
        <button type="submit" className="min-h-11 rounded-xl border border-borda bg-cartao px-4 text-sm font-medium hover:bg-fundo">
          Filtrar
        </button>
      </form>

      {!linhas.length ? (
        <Vazio>Nada registrado com esses filtros.</Vazio>
      ) : (
        <ol className="flex flex-col divide-y divide-borda rounded-2xl border border-borda bg-cartao">
          {linhas.map((l) => (
            <li key={l.id} className="flex flex-col gap-1 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pilula className={l.acao === "senha_errada" ? "bg-ruim-fundo text-ruim" : l.tipo === "seguranca" ? "bg-alerta-fundo text-alerta" : "bg-neutro-fundo text-neutro"}>
                  {ROTULO_TIPO[l.tipo] ?? l.tipo}
                </Pilula>
                <span className="text-xs text-suave">{dataHoraBR(l.criado_em)}</span>
              </div>
              <p className="break-words text-sm">{l.descricao}</p>
              <p className="break-all text-xs text-suave">
                {l.email || "Sistema (recebimento automático)"}
                {l.ip || l.aparelho ? ` · ${[l.aparelho, l.ip && `IP ${l.ip}`].filter(Boolean).join(" · ")}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
      {temMais ? (
        <Link href={busca({ antes: String(linhas.at(-1)!.id) })} className="self-center text-sm font-semibold text-marca-forte hover:underline">
          Ver mais antigos →
        </Link>
      ) : null}
    </section>
  );
}

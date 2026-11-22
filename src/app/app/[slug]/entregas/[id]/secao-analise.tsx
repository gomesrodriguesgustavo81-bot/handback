import { BotaoConfirmar } from "@/components/form-acao";
import { BotaoAnalisar, BotaoCopiar, FormRevisao } from "@/components/analise";
import { Aviso, Cartao, Selo } from "@/components/ui";
import type { Vocabulario } from "@/lib/frentes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { dataHoraBR, passouMaisDe } from "@/lib/textos";
import { reabrirDevolutiva } from "../acoes";

type Analise = {
  status: "analisando" | "pronta" | "erro" | "aprovada";
  iniciada_em: string;
  modelo: string;
  segundos: number | null;
  checklist: { item: string; status: "ENTREGUE" | "PARCIAL" | "NAO_ENTREGUE"; evidencia: string }[];
  conceito_ia: string | null;
  justificativa: string;
  analise_interna: string;
  evolucao: string;
  jornada: string;
  arquivos_lidos: string[];
  avisos_leitura: string[];
  erro: string;
  conceito: string | null;
  devolutiva: string;
  aprovada_em: string | null;
};

const ICONE = { ENTREGUE: "✅", PARCIAL: "🟡", NAO_ENTREGUE: "❌" } as const;
const ROTULO = { ENTREGUE: "Entregue", PARCIAL: "Parcial", NAO_ENTREGUE: "Não entregue" } as const;

/** Análise da IA, revisão e aprovação da devolutiva de uma entrega. */
export async function SecaoAnalise({
  slug,
  entregaId,
  substituida,
  v,
}: {
  slug: string;
  entregaId: string;
  substituida: boolean;
  v: Vocabulario;
}) {
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("analises").select("*").eq("entrega_id", entregaId).maybeSingle();
  const a = data as Analise | null;
  const travada = a?.status === "analisando" && passouMaisDe(a.iniciada_em, 5);

  if (!a || a.status === "erro" || travada) {
    return (
      <Cartao className="flex flex-col gap-3">
        <h3 className="font-semibold">Análise e devolutiva</h3>
        {a?.erro ? <Aviso tipo="erro">A última análise falhou: {a.erro}</Aviso> : null}
        {substituida ? (
          <p className="text-sm text-suave">Esta entrega foi substituída por um reenvio: analise a mais recente.</p>
        ) : (
          <>
            <p className="text-sm text-suave">
              A IA confere o checklist d{/a$/i.test(v.etapa) ? "a" : "o"} {v.etapa.toLowerCase()}, sugere um conceito, escreve
              uma análise interna e um rascunho de devolutiva. Nada é enviado sem a sua aprovação.
            </p>
            <BotaoAnalisar slug={slug} entregaId={entregaId} texto={a ? "Tentar de novo" : "Analisar com IA"} />
          </>
        )}
      </Cartao>
    );
  }

  if (a.status === "analisando") {
    return (
      <Cartao className="flex flex-col gap-2">
        <h3 className="font-semibold">Análise e devolutiva</h3>
        <Aviso>A IA está analisando esta entrega (começou às {dataHoraBR(a.iniciada_em).split(" às ")[1]}). Atualize a página daqui a pouco.</Aviso>
      </Cartao>
    );
  }

  const aprovada = a.status === "aprovada";
  return (
    <>
      <Cartao className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Análise da IA</h3>
          <div className="flex flex-wrap gap-2">
            {a.conceito_ia ? <Selo>Sugestão: {a.conceito_ia}</Selo> : null}
            {a.evolucao ? <Selo>{a.evolucao}</Selo> : null}
          </div>
        </div>
        {a.erro ? <Aviso tipo="alerta">A última tentativa de reanálise falhou ({a.erro}); este é o resultado anterior.</Aviso> : null}

        <ul className="flex flex-col gap-2" aria-label="Checklist">
          {a.checklist.map((c, i) => (
            <li key={i} className="rounded-xl bg-fundo p-3 text-sm">
              <p className="font-medium">
                <span aria-hidden>{ICONE[c.status]}</span> {c.item} <span className="font-normal text-suave">· {ROTULO[c.status]}</span>
              </p>
              {c.evidencia ? <p className="mt-1 text-suave">{c.evidencia}</p> : null}
            </li>
          ))}
        </ul>

        {a.justificativa ? (
          <div className="text-sm">
            <p className="text-suave">Por que esse conceito</p>
            <p>{a.justificativa}</p>
          </div>
        ) : null}
        {a.jornada && a.jornada.includes("➔") ? (
          <p className="text-sm">
            <span className="text-suave">Jornada do grupo:</span> {a.jornada}
          </p>
        ) : null}

        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-marca-forte">Análise interna (só para quem avalia)</summary>
          <p className="mt-2 whitespace-pre-line">{a.analise_interna}</p>
        </details>

        {a.avisos_leitura.length ? (
          <Aviso tipo="alerta">
            <p className="font-medium">Avisos de leitura</p>
            <ul className="list-disc pl-4">
              {a.avisos_leitura.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </Aviso>
        ) : null}
        <p className="text-xs text-suave">
          Lido: {a.arquivos_lidos.join("; ") || "só o texto"} · {a.modelo}
          {a.segundos ? ` · ${a.segundos}s` : ""}
        </p>
        {!aprovada && !substituida ? (
          <BotaoAnalisar slug={slug} entregaId={entregaId} texto="Analisar de novo" variante="secundario" />
        ) : null}
      </Cartao>

      <Cartao className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Devolutiva</h3>
          {aprovada ? <Selo>Aprovada · {a.conceito}</Selo> : <Selo>Rascunho</Selo>}
        </div>
        {aprovada ? (
          <>
            <p className="whitespace-pre-line rounded-xl bg-fundo p-4 leading-relaxed">{a.devolutiva}</p>
            <p className="text-xs text-suave">Aprovada em {dataHoraBR(a.aprovada_em)}. O envio por e-mail chega na próxima fase; por enquanto, copie o texto.</p>
            <div className="flex flex-wrap gap-2">
              <BotaoCopiar texto={a.devolutiva} />
              <BotaoConfirmar acao={reabrirDevolutiva.bind(null, slug, entregaId)} pergunta="Reabrir a devolutiva para editar?">
                Reabrir para editar
              </BotaoConfirmar>
            </div>
          </>
        ) : (
          <FormRevisao
            slug={slug}
            entregaId={entregaId}
            conceito={a.conceito ?? a.conceito_ia ?? "PENDENTE"}
            devolutiva={a.devolutiva}
            conceitoIa={a.conceito_ia}
          />
        )}
      </Cartao>
    </>
  );
}

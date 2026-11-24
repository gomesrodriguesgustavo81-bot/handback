import { AreaTexto, Campo } from "@/components/ui";
import type { Vocabulario } from "@/lib/frentes";
import { minusc } from "@/lib/textos";

export type DadosEtapa = {
  numero: number;
  titulo: string;
  data: string | null;
  recebe_de: string | null;
  recebe_ate: string | null;
  entregaveis: string[];
  criterios: string;
  observacoes_ia: string;
};

/**
 * Campos do formulário de etapa (os mesmos para criar e editar).
 * parte: só um pedaço, para o assistente de criar (1 nome e prazo, 2 o que
 * entregar, 3 detalhes para a IA).
 */
export function CamposEtapa({ v, inicial, somenteLeitura = false, parte }: { v: Vocabulario; inicial?: Partial<DadosEtapa>; somenteLeitura?: boolean; parte?: 1 | 2 | 3 }) {
  const ro = somenteLeitura;
  const mostra = (n: 1 | 2 | 3) => !parte || parte === n;
  return (
    <>
      {mostra(1) ? (
      <>
      <div className="grid grid-cols-[6rem_1fr] gap-3">
        <Campo rotulo="Nº" name="numero" type="number" min={1} max={9999} required defaultValue={inicial?.numero} readOnly={ro} />
        <Campo rotulo="Título" name="titulo" required defaultValue={inicial?.titulo} readOnly={ro} placeholder="Ex.: Diagnóstico do problema" />
      </div>
      <Campo rotulo={`Data d${artigo(v.etapa)} ${minusc(v.etapa)}`} name="data" type="date" defaultValue={inicial?.data ?? ""} readOnly={ro} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo rotulo="Recebe entregas de" name="recebe_de" type="date" defaultValue={inicial?.recebe_de ?? ""} readOnly={ro} />
        <Campo
          rotulo="Recebe entregas até"
          name="recebe_ate"
          type="date"
          defaultValue={inicial?.recebe_ate ?? ""}
          readOnly={ro}
          dica="Vale até 23:59 desse dia. Depois disso, a entrega fica marcada como “com atraso”."
        />
      </div>
      </>
      ) : null}
      {mostra(2) ? (
      <>
      <AreaTexto
        rotulo="O que deve ser entregue (checklist)"
        name="entregaveis"
        rows={5}
        defaultValue={(inicial?.entregaveis ?? []).join("\n")}
        readOnly={ro}
        placeholder={"Um item por linha. Ex.:\nMapa de stakeholders\nProblema em uma frase"}
        dica="Um item por linha. A IA vai conferir item por item: entregue, parcial ou não entregue."
      />
      <AreaTexto
        rotulo="Critérios de qualidade"
        name="criterios"
        defaultValue={inicial?.criterios ?? ""}
        readOnly={ro}
        placeholder="O que diferencia uma entrega excelente de uma boa."
      />
      </>
      ) : null}
      {mostra(3) ? (
      <AreaTexto
        rotulo="Observações para a IA (opcional)"
        name="observacoes_ia"
        rows={3}
        defaultValue={inicial?.observacoes_ia ?? ""}
        readOnly={ro}
        placeholder="Algo que a IA deve levar em conta nesta análise."
      />
      ) : null}
    </>
  );
}

/** "a" ou "o" para concordar com a palavra (Aula → "da aula", Ciclo → "do ciclo"). */
function artigo(palavra: string): "a" | "o" {
  const p = palavra.trim().toLowerCase();
  return /(a|ência|ção|ão|dade|agem)$/.test(p) && !/^(dia|tema|problema)$/.test(p) ? "a" : "o";
}

import { CONCEITOS, type Contagem } from "@/lib/coordenacao";

const NOME: Record<string, string> = { EXCELENTE: "Excelente", BOM: "Bom", REGULAR: "Regular", RUIM: "Ruim" };
const COR: Record<string, string> = { EXCELENTE: "bg-exc", BOM: "bg-bom", REGULAR: "bg-reg", RUIM: "bg-ruim" };

/** Barra empilhada dos conceitos, com o número escrito logo abaixo (não depende só da cor). */
export function BarraDeConceitos({ conta, vazio = "Ainda sem conceito aprovado." }: { conta: Contagem; vazio?: string }) {
  const total = CONCEITOS.reduce((s, c) => s + conta[c], 0);
  if (!total) return <p className="text-[13px] text-suave">{vazio}</p>;
  return (
    <>
      <span aria-hidden className="flex h-2.5 gap-0.5 overflow-hidden rounded-md">
        {CONCEITOS.filter((c) => conta[c] > 0).map((c) => (
          <span key={c} className={COR[c]} style={{ flex: conta[c] }} />
        ))}
      </span>
      <span className="text-[13px] text-texto">{CONCEITOS.map((c) => `${NOME[c]} ${conta[c]}`).join(" · ")}</span>
    </>
  );
}

export const NOME_CONCEITO = NOME;

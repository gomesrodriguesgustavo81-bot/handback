import "server-only";
import { chamarGemini } from "./gemini";
import { addTexto, lerArquivo, novoConteudo } from "./leitura";

export type CicloDoPlano = {
  numero: number;
  titulo: string;
  data: string;
  recebe_de: string;
  recebe_ate: string;
  entregaveis: string[];
  criterios: string;
};

const ESQUEMA = {
  type: "OBJECT",
  properties: {
    ciclos: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          numero: { type: "INTEGER" },
          titulo: { type: "STRING" },
          data: { type: "STRING", description: "AAAA-MM-DD do dia da aula, ou vazio" },
          recebe_de: { type: "STRING", description: "AAAA-MM-DD em que começa a receber, ou vazio" },
          recebe_ate: { type: "STRING", description: "AAAA-MM-DD do prazo de entrega, ou vazio" },
          entregaveis: { type: "ARRAY", items: { type: "STRING" } },
          criterios: { type: "STRING" },
        },
        required: ["numero", "titulo", "data", "recebe_de", "recebe_ate", "entregaveis", "criterios"],
      },
    },
  },
  required: ["ciclos"],
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lê um plano de ensino (texto colado e/ou arquivo) e devolve as entregas do
 * semestre, uma por ciclo, para o professor revisar antes de criar.
 */
export async function lerPlanoDeEnsino(
  texto: string,
  arquivo: { dados: Uint8Array; nome: string; tipo: string } | null,
  palavraEtapa: string,
  hoje: string,
): Promise<CicloDoPlano[]> {
  const c = novoConteudo();
  addTexto(c, "PLANO DE ENSINO (texto colado)", texto);
  if (arquivo) lerArquivo(c, arquivo.dados, arquivo.nome, arquivo.tipo);
  if (!c.textos.length && !c.partes.length) throw new Error(c.avisos[0] ?? "Cole o texto do plano de ensino ou envie o arquivo.");
  const sistema = [
    `Você ajuda um professor a montar no Handback as entregas do semestre a partir do PLANO DE ENSINO.`,
    `Cada entrega vira um "${palavraEtapa}" (com número, título, prazo e o que deve ser entregue).`,
    `Regras:`,
    `- Liste só o que os alunos ENTREGAM (trabalhos, relatórios, protótipos, listas, apresentações). Aulas sem entrega não entram.`,
    `- numero: a ordem no semestre (1, 2, 3…), ou o número que o plano usar.`,
    `- titulo: curto (até 8 palavras), sem repetir "${palavraEtapa} N".`,
    `- Datas no formato AAAA-MM-DD. Hoje é ${hoje}: se o plano não disser o ano, use o ano do semestre que está começando ou em andamento.`,
    `- recebe_ate: o prazo. recebe_de: quando a entrega abre (se o plano não disser, deixe vazio). data: o dia da aula ligada à entrega, se houver.`,
    `- Se o plano não tiver a data, deixe o campo vazio. Nunca invente datas.`,
    `- entregaveis: a lista do que deve ser entregue (cada item curto, como num checklist).`,
    `- criterios: os critérios de avaliação daquela entrega, se o plano disser; senão, vazio.`,
    `- Escreva em português, sem inventar conteúdo que não está no plano.`,
  ].join("\n");
  const partes = [...c.textos.map((t) => ({ text: t })), ...c.partes];
  const { resultado } = await chamarGemini(sistema, partes, ESQUEMA);
  const lista = ((resultado as { ciclos?: CicloDoPlano[] }).ciclos ?? []).slice(0, 60);
  const limpa = (d: string) => (DATA.test(String(d ?? "")) ? String(d) : "");
  return lista
    .map((x, i) => ({
      numero: Number.isInteger(x.numero) && x.numero > 0 && x.numero < 10000 ? x.numero : i + 1,
      titulo: String(x.titulo ?? "").trim().slice(0, 200),
      data: limpa(x.data),
      recebe_de: limpa(x.recebe_de),
      recebe_ate: limpa(x.recebe_ate),
      entregaveis: (x.entregaveis ?? []).map((s) => String(s).trim()).filter(Boolean).slice(0, 50),
      criterios: String(x.criterios ?? "").trim().slice(0, 5000),
    }))
    .filter((x) => x.titulo.length >= 2);
}

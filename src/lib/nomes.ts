/**
 * Nomes que cada cliente usa (turma, grupo, pessoa, etapa…): plural
 * automático, masculino/feminino e as sugestões por tipo de uso.
 */
import type { Vocabulario } from "./frentes";

export type Genero = "f" | "m";
export type Modo = "grupos" | "individual";

const FEMININAS = new Set(
  [
    "turma", "sala", "área", "area", "escola", "empresa", "agência", "agencia", "faculdade", "universidade", "consultoria", "carteira", "equipe", "aula", "entrega", "etapa", "competência", "squad", "célula", "celula",
    "unidade", "classe", "trilha", "sprint", "pessoa", "empresa", "residência", "mentoria", "frente", "fase", "semana", "rodada",
  ].map((x) => x.toLowerCase()),
);
const MASCULINAS = new Set(["espaço", "espaco", "escritório", "escritorio", "hub", "laboratório", "laboratorio", "time", "grupo", "projeto", "programa", "ciclo", "encontro", "módulo", "modulo", "mês", "mes", "aluno", "cliente", "membro"]);

/** Plural em português para as palavras do dia a dia (regras simples, suficientes para nomes). */
export function plural(palavra: string): string {
  const p = palavra.trim();
  if (!p) return p;
  // Nomes compostos: "Equipe de projeto" → "Equipes de projeto".
  const m = p.match(/^(\S+)(\s+(?:de|do|da|dos|das)\s+.+)$/i);
  if (m) return plural(m[1]) + m[2];
  if (/[sx]$/i.test(p) && !/ês$/i.test(p)) return p;
  if (/ês$/i.test(p)) return p.replace(/ês$/i, "eses");
  if (/ão$/i.test(p)) return p.replace(/ão$/i, "ões");
  if (/m$/i.test(p)) return p.replace(/m$/i, "ns");
  if (/[rz]$/i.test(p)) return `${p}es`;
  if (/al$/i.test(p)) return p.replace(/al$/i, "ais");
  // Paroxítonas (Responsável, Possível): "eis" sem acento; oxítonas (Papel, Painel): "éis".
  if (/[áéíóú][^áéíóú]*el$/i.test(p)) return p.replace(/el$/i, "eis");
  if (/el$/i.test(p)) return p.replace(/el$/i, "éis");
  if (/ol$/i.test(p)) return p.replace(/ol$/i, "óis");
  if (/ul$/i.test(p)) return p.replace(/ul$/i, "uis");
  if (/il$/i.test(p)) return p.replace(/il$/i, "is");
  return `${p}s`;
}

/** Palpite de masculino/feminino pela palavra principal. */
export function generoDe(palavra: string): Genero {
  const base = palavra.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (FEMININAS.has(base)) return "f";
  if (MASCULINAS.has(base)) return "m";
  return /a$|ção$|dade$|gem$/.test(base) ? "f" : "m";
}

export type Vocab = Required<Omit<Vocabulario, "generos" | "pessoa" | "pessoas" | "espaco" | "espacos" | "organizacao" | "organizacoes" | "matricula">> & {
  matricula: string;
  organizacao: string;
  organizacoes: string;
  espaco: string;
  espacos: string;
  pessoa: string;
  pessoas: string;
  generos: Record<"etapa" | "grupo" | "espaco" | "pessoa" | "organizacao", Genero>;
};

/** Completa o vocabulário guardado com os campos novos (contas antigas não têm). */
export function completarVocabulario(v: Vocabulario): Vocab {
  const espaco = v.espaco || "Turma";
  const pessoa = v.pessoa || "Pessoa";
  const organizacao = v.organizacao || "Espaço";
  return {
    ...v,
    matricula: v.matricula || "Matrícula",
    organizacao,
    organizacoes: v.organizacoes || plural(organizacao),
    espaco,
    espacos: v.espacos || plural(espaco),
    pessoa,
    pessoas: v.pessoas || plural(pessoa),
    generos: {
      etapa: v.generos?.etapa ?? generoDe(v.etapa),
      grupo: v.generos?.grupo ?? generoDe(v.grupo),
      espaco: v.generos?.espaco ?? generoDe(espaco),
      pessoa: v.generos?.pessoa ?? generoDe(pessoa),
      organizacao: v.generos?.organizacao ?? generoDe(organizacao),
    },
  };
}

/** Artigo definido: o(v, "etapa") → "a" (Aula) ou "o" (Ciclo). */
export function o(v: Vocab, campo: keyof Vocab["generos"], noPlural = false): string {
  const a = v.generos[campo] === "f" ? "a" : "o";
  return noPlural ? `${a}s` : a;
}

/** Nome de quem entrega numa turma: grupos ("Equipe") ou pessoas individuais ("Aluno"). */
export function quemEntrega(v: Vocab, modo: Modo): { um: string; varios: string; genero: Genero } {
  return modo === "individual"
    ? { um: v.pessoa, varios: v.pessoas, genero: v.generos.pessoa }
    : { um: v.grupo, varios: v.grupos, genero: v.generos.grupo };
}

export type Uso = {
  id: string;
  nome: string;
  descricao: string;
  modo: Modo;
  espaco: string;
  grupo: string;
  pessoa: string;
  etapa: string;
  avaliador: string;
  exemploEspaco: string;
};

/** Sugestões para o primeiro acesso, por tipo de uso. */
export const USOS: Uso[] = [
  { id: "universidade", nome: "Universidade ou faculdade", descricao: "Alunos entregam para o professor", modo: "individual", espaco: "Turma", grupo: "Grupo", pessoa: "Aluno", etapa: "Aula", avaliador: "Professor", exemploEspaco: "Ex.: Cálculo I — Noturno" },
  { id: "escola", nome: "Escola ou curso", descricao: "Alunos ou grupos entregam para o professor", modo: "grupos", espaco: "Turma", grupo: "Grupo", pessoa: "Aluno", etapa: "Aula", avaliador: "Professor", exemploEspaco: "Ex.: 9º ano B" },
  { id: "hub", nome: "Hub, aceleradora ou residência", descricao: "Times de residentes entregam para a coordenação", modo: "grupos", espaco: "Programa", grupo: "Time", pessoa: "Residente", etapa: "Entrega", avaliador: "Mentor", exemploEspaco: "Ex.: Residência 2026" },
  { id: "consultoria", nome: "Consultoria", descricao: "Equipes entregam para o consultor", modo: "grupos", espaco: "Projeto", grupo: "Equipe", pessoa: "Consultor", etapa: "Entrega", avaliador: "Revisor", exemploEspaco: "Ex.: Projeto Transformação Digital" },
  { id: "empresa", nome: "Empresa", descricao: "Times entregam para o gestor", modo: "grupos", espaco: "Área", grupo: "Time", pessoa: "Colaborador", etapa: "Sprint", avaliador: "Gestor", exemploEspaco: "Ex.: Marketing" },
  { id: "escritorio", nome: "Contabilidade ou advocacia", descricao: "Clientes entregam para o escritório", modo: "individual", espaco: "Carteira", grupo: "Grupo", pessoa: "Cliente", etapa: "Mês", avaliador: "Responsável", exemploEspaco: "Ex.: Clientes PJ" },
];

export const OPCOES_NOMES = {
  espaco: ["Turma", "Sala", "Programa", "Projeto", "Área", "Carteira"],
  grupo: ["Equipe", "Time", "Grupo", "Squad"],
  pessoa: ["Aluno", "Residente", "Consultor", "Colaborador", "Cliente", "Membro"],
  etapa: ["Aula", "Ciclo", "Encontro", "Sprint", "Módulo", "Mês"],
} as const;

/** Lê uma lista colada (um por linha): "Nome; e-mail", "Nome <e-mail>", "Nome, e-mail" ou só o e-mail. */
export function lerListaDePessoas(texto: string): { nome: string; email: string; erro: string }[] {
  const vistos = new Set<string>();
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 500)
    .map((linha) => {
      const email = (linha.match(/[^\s<>;,"]+@[^\s<>;,"]+\.[^\s<>;,"]+/) ?? [""])[0].toLowerCase();
      let nome = linha.replace(new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ").replace(/[<>;,"\t]/g, " ").replace(/\s+/g, " ").trim();
      if (!nome && email) {
        nome = email
          .split("@")[0]
          .replace(/[._-]+/g, " ")
          .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
      }
      let erro = "";
      if (!email) erro = "falta o e-mail";
      else if (vistos.has(email)) erro = "repetido na lista";
      vistos.add(email);
      return { nome: nome.slice(0, 120) || "(sem nome)", email, erro };
    });
}

/** Monta o vocabulário completo só a partir das palavras no singular. */
export function montarVocabulario(s: { etapa: string; grupo: string; espaco: string; pessoa: string; avaliador: string; organizacao?: string; matricula?: string }) {
  const limpar = (x: string) => x.trim().replace(/\s+/g, " ").slice(0, 40);
  const etapa = limpar(s.etapa);
  const grupo = limpar(s.grupo);
  const espaco = limpar(s.espaco);
  const pessoa = limpar(s.pessoa);
  const avaliador = limpar(s.avaliador);
  const organizacao = limpar(s.organizacao ?? "") || "Espaço";
  const matricula = limpar(s.matricula ?? "") || "Matrícula";
  return {
    matricula,
    organizacao,
    organizacoes: plural(organizacao),
    etapa,
    etapas: plural(etapa),
    grupo,
    grupos: plural(grupo),
    espaco,
    espacos: plural(espaco),
    pessoa,
    pessoas: plural(pessoa),
    avaliador,
    avaliadores: plural(avaliador),
    generos: { etapa: generoDe(etapa), grupo: generoDe(grupo), espaco: generoDe(espaco), pessoa: generoDe(pessoa), organizacao: generoDe(organizacao) },
  };
}

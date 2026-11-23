import "server-only";
import ExcelJS from "exceljs";
import { notaDoConceito } from "./moodle/cliente";
import { nota, type Celula, type Relatorio } from "./relatorios";

/** Linhas da planilha: uma por aluno (com a equipe dele, no modo em grupo). */
export function linhasDaPlanilha(r: Relatorio, comMatricula: boolean) {
  const grupos = r.turma.modo === "grupos";
  const cab = [
    ...(grupos ? [r.vc.grupo] : []),
    grupos ? r.vc.pessoa : r.vc.pessoa,
    ...(comMatricula ? [r.vc.matricula] : []),
    "E-mail",
    ...r.etapas.map((e) => `${r.vc.etapa} ${e.numero} · ${e.titulo}`),
    ...(r.turma.mediaAtiva ? ["Média (0 a 10)"] : []),
  ];
  const texto = (c: Celula) => (c.tipo === "aprovado" ? c.conceito : c.tipo === "nao-entregou" ? "não entregou" : c.tipo === "pendente" ? "em avaliação" : "");
  const linhas: (string | number)[][] = [];
  for (const g of r.grupos) {
    const pessoas = g.pessoas.length ? g.pessoas : [{ nome: grupos ? "" : g.nome, email: "", matricula: "" }];
    for (const p of pessoas) {
      linhas.push([
        ...(grupos ? [g.nome] : []),
        p.nome || (grupos ? "" : g.nome),
        ...(comMatricula ? [p.matricula] : []),
        p.email,
        ...g.celulas.map(texto),
        ...(r.turma.mediaAtiva ? [g.media === null ? "" : g.media] : []),
      ]);
    }
  }
  return { cab, linhas };
}

/** Planilha não pode virar fórmula (=, +, -, @ no começo): prefixa com apóstrofo. */
function seguro(v: string | number): string | number {
  if (typeof v === "number") return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

const AVISO = "Contém dados pessoais dos alunos. Uso interno: não compartilhe fora da instituição.";

export function csvDaTurma(r: Relatorio, comMatricula: boolean): string {
  const { cab, linhas } = linhasDaPlanilha(r, comMatricula);
  const cel = (v: string | number) => {
    const s = typeof v === "number" ? nota(v) : String(seguro(v));
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Ponto e vírgula e BOM: o Excel em português abre certinho.
  return "﻿" + [cab, ...linhas].map((l) => l.map(cel).join(";")).join("\r\n") + "\r\n";
}

export async function xlsxDaTurma(r: Relatorio, comMatricula: boolean): Promise<Buffer> {
  const { cab, linhas } = linhasDaPlanilha(r, comMatricula);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Handback";
  const ws = wb.addWorksheet("Conceitos", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.addRow(cab);
  for (const l of linhas) ws.addRow(l.map(seguro));
  ws.getRow(1).font = { bold: true };
  ws.columns.forEach((c, i) => {
    c.width = Math.min(40, Math.max(12, String(cab[i] ?? "").length + 2));
  });
  if (r.turma.mediaAtiva) ws.getColumn(cab.length).numFmt = "0.0";
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cab.length } };

  const dv = wb.addWorksheet("Devolutivas");
  dv.addRow([r.vc.grupo, r.vc.etapa, "Conceito", "Devolutiva"]);
  dv.getRow(1).font = { bold: true };
  for (const g of r.grupos) {
    g.celulas.forEach((c, i) => {
      if (c.tipo === "aprovado" && c.devolutiva) dv.addRow([seguro(g.nome), `${r.etapas[i].numero} · ${seguro(r.etapas[i].titulo)}`, c.conceito, seguro(c.devolutiva)]);
    });
  }
  dv.columns = [{ width: 24 }, { width: 28 }, { width: 12 }, { width: 90 }];
  dv.getColumn(4).alignment = { wrapText: true, vertical: "top" };

  const sobre = wb.addWorksheet("Sobre");
  sobre.addRow([`${r.org.nome} · ${r.turma.nome}`]);
  sobre.addRow([`Gerado pelo Handback em ${new Date(r.geradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`]);
  sobre.addRow(["Só entram conceitos aprovados por um professor."]);
  if (r.turma.mediaAtiva) sobre.addRow([`Média ponderada pelos pesos de cada ${r.vc.etapa.toLowerCase()}; não entregou conta 0.`]);
  sobre.addRow([AVISO]);
  sobre.getColumn(1).width = 90;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Arquivo para importar no livro de notas do Moodle (Notas › Importar › CSV):
 * e-mail de cada aluno e a nota de cada tarefa, na escala da tarefa.
 */
export function csvMoodle(r: Relatorio): string {
  const tarefas = r.etapas.map((e, i) => ({ e, i })).filter((x) => x.e.moodle_tarefa && x.e.moodle_nota_max);
  const cab = ["Endereço de email", ...tarefas.map((x) => x.e.titulo)];
  const linhas: string[][] = [];
  for (const g of r.grupos) {
    for (const p of g.pessoas) {
      if (!p.email) continue;
      linhas.push([
        p.email,
        ...tarefas.map(({ e, i }) => {
          const c = g.celulas[i];
          const n = c?.tipo === "aprovado" ? notaDoConceito(e.moodle_nota_max, c.nota * 10) : null;
          return n === null ? "" : String(n);
        }),
      ]);
    }
  }
  const cel = (v: string) => {
    const s = String(seguro(v));
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cab, ...linhas].map((l) => l.map(cel).join(",")).join("\r\n") + "\r\n";
}

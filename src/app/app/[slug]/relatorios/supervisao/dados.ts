import "server-only";
import { notFound } from "next/navigation";
import { contextoDaEmpresa } from "@/lib/empresa";
import { montarSupervisao, type LinhaBruta } from "@/lib/supervisao";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual } from "@/lib/turma";

type Linha = {
  grupos: { nome: string } | null;
  etapas: { numero: number; titulo: string } | null;
  analises: {
    status: string;
    conceito_ia: string | null;
    conceito: string | null;
    conceito_escolhido: boolean;
    motivo_mudanca: string;
    aprovada_em: string | null;
    aprovada_por: string | null;
    alertas: unknown;
  } | null;
};

/** Registro de supervisão da turma aberta: só quem avalia vê (o coordenador não). */
export async function carregarSupervisao(slug: string) {
  const { empresa, podeAvaliar } = await contextoDaEmpresa(slug);
  if (!podeAvaliar) notFound();
  const turma = await turmaAtual(empresa.id);
  if (!turma) notFound();
  const supabase = await criarClienteServidor();
  const [{ data }, { data: pessoas }, { data: eu }] = await Promise.all([
    supabase
      .from("entregas")
      .select("grupos(nome), etapas!inner(numero, titulo, turma_id), analises(status, conceito_ia, conceito, conceito_escolhido, motivo_mudanca, aprovada_em, aprovada_por, alertas)")
      .eq("org_id", empresa.id)
      .eq("etapas.turma_id", turma.id)
      .eq("status", "recebida")
      .limit(5000),
    // Só quem administra lê os e-mails das pessoas; os outros veem "você" e "outra pessoa".
    supabase.rpc("pessoas_da_org", { org: empresa.id }),
    supabase.auth.getUser(),
  ]);
  const emails = new Map(((pessoas ?? []) as { user_id: string; email: string }[]).map((p) => [p.user_id, p.email]));
  const meuId = eu.user?.id ?? "";
  const quemAprovou = (id: string | null) => (id ? (emails.get(id) ?? (id === meuId ? "você" : "outra pessoa")) : "");
  const brutas: LinhaBruta[] = ((data ?? []) as unknown as Linha[])
    .filter((l) => l.analises && l.grupos && l.etapas)
    .map((l) => ({
      grupo: l.grupos!.nome,
      etapaNumero: l.etapas!.numero,
      etapaTitulo: l.etapas!.titulo,
      status: l.analises!.status,
      conceitoIa: l.analises!.conceito_ia,
      conceito: l.analises!.conceito,
      escolhido: l.analises!.conceito_escolhido,
      motivo: l.analises!.motivo_mudanca ?? "",
      aprovadaEm: l.analises!.aprovada_em,
      aprovadaPor: l.analises!.aprovada_por,
      alertas: Array.isArray(l.analises!.alertas) ? (l.analises!.alertas as unknown[]).length : 0,
    }));
  return { empresa, turma, supabase, linhas: montarSupervisao(brutas, quemAprovou) };
}

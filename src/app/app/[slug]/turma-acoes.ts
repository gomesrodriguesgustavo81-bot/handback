"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { contextoDaEmpresa } from "@/lib/empresa";
import { cookieDaTurma, turmasDaEmpresa } from "@/lib/turma";

/** Troca a turma mostrada (só para quem está trocando; fica guardada no navegador). */
export async function escolherTurma(slug: string, turmaId: string): Promise<void> {
  const { empresa } = await contextoDaEmpresa(slug);
  const turmas = await turmasDaEmpresa(empresa.id);
  if (!turmas.some((t) => t.id === turmaId)) return;
  (await cookies()).set(cookieDaTurma(empresa.id), turmaId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath(`/app/${slug}`, "layout");
}

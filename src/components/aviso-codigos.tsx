import Link from "next/link";
import { sessaoBasica } from "@/lib/sessao";
import { criarClienteServidor } from "@/lib/supabase/server";

/**
 * Duas etapas ativas e nenhum código de recuperação guardado: lembra de gerar
 * (se perder o celular, a pessoa ficaria sem acesso). Aparece só no Início.
 */
export async function AvisoCodigos() {
  const s = await sessaoBasica();
  if (!s.temSegundaEtapa || s.nivel !== "aal2") return null;
  const { data: restantes } = await (await criarClienteServidor()).rpc("meus_codigos_de_recuperacao");
  if (Number(restantes ?? 0) > 0) return null;
  return (
    <section role="status" aria-label="Códigos de recuperação" className="flex flex-col gap-1 rounded-2xl bg-alerta-fundo px-4 py-3 text-sm text-alerta">
      <strong className="text-[15px]">Guarde seus códigos de recuperação</strong>
      <span>Se perder o celular, eles são a forma de voltar a entrar.</span>
      <Link href="/conta#codigos" className="self-start font-semibold underline">
        Gerar agora
      </Link>
    </section>
  );
}

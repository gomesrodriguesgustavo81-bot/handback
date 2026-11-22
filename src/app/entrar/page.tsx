import type { Metadata } from "next";
import Link from "next/link";
import { Marca } from "@/components/marca";
import { Aviso, Cartao } from "@/components/ui";
import { SemConfiguracao } from "@/components/sem-configuracao";
import { supabaseConfigurado } from "@/lib/supabase/config";
import { caminhoSeguro } from "@/lib/caminhos";
import { entrarComGoogle } from "./actions";
import { FormularioEntrar } from "./formulario";

export const metadata: Metadata = { title: "Entrar" };

const ERROS: Record<string, string> = {
  link: "O link expirou ou já foi usado. Entre com sua senha ou peça um link novo em “Esqueci minha senha”.",
  google: "Não foi possível entrar com o Google. Se você ainda não tem acesso, peça um convite ao administrador da sua empresa.",
};

function IconeGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default async function Entrar({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const voltar = caminhoSeguro(params.voltar);
  const erro = typeof params.erro === "string" ? ERROS[params.erro] : undefined;
  const google = process.env.HANDBACK_LOGIN_GOOGLE === "1";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Marca tamanho="lg" />
          <p className="text-sm text-suave">Você recebe, a gente devolve conferido.</p>
        </div>
        <Cartao className="flex flex-col gap-5">
          <h1 className="text-xl font-semibold">Entrar</h1>
          {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
          {supabaseConfigurado() ? (
            <>
              {google ? (
                <>
                  <form action={entrarComGoogle}>
                    <input type="hidden" name="voltar" value={voltar} />
                    <button
                      type="submit"
                      className="flex min-h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-borda bg-cartao px-4 font-medium hover:bg-fundo"
                    >
                      <IconeGoogle />
                      Entrar com Google
                    </button>
                  </form>
                  <div className="flex items-center gap-3 text-xs text-suave">
                    <span className="h-px flex-1 bg-borda" />
                    ou com e-mail e senha
                    <span className="h-px flex-1 bg-borda" />
                  </div>
                </>
              ) : null}
              <FormularioEntrar voltar={voltar} />
            </>
          ) : (
            <SemConfiguracao />
          )}
        </Cartao>
        <div className="flex flex-col gap-1 text-center text-sm text-suave">
          <p>
            Ainda não tem conta?{" "}
            <Link href="/criar-conta" className="font-semibold text-marca-forte hover:underline">
              Criar minha conta
            </Link>
          </p>
          <p>Foi convidado? Use o link do e-mail de convite para criar sua senha.</p>
          <p>
            Sem convite? Peça a quem administra o seu espaço. ·{" "}
            <Link href="/privacidade" className="hover:text-texto hover:underline">
              Privacidade
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

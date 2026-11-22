import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Aviso, Cartao } from "@/components/ui";
import { CampoAuto } from "@/components/campo-auto";
import { EnderecoDaTurma } from "@/components/endereco-turma";
import { enderecoDeRecebimento } from "@/lib/emails/endereco";
import { contextoDaEmpresa } from "@/lib/empresa";
import { criarClienteServidor } from "@/lib/supabase/server";
import { turmaAtual, turmasDaEmpresa } from "@/lib/turma";

export const metadata: Metadata = { title: "Receber por e-mail" };

export default async function Recebimento({ params }: PageProps<"/app/[slug]/configuracoes/recebimento">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();
  const [turmas, turma] = await Promise.all([turmasDaEmpresa(empresa.id), turmaAtual(empresa.id)]);
  const varias = turmas.length > 1;
  const { data: config } = await supabase
    .from("organizacoes")
    .select("etiqueta_assunto, modo_entrega, assuntos_ignorar")
    .eq("id", empresa.id)
    .single();
  const endereco = turma ? enderecoDeRecebimento(turma.caixa_token) : null;
  const etiqueta = `[${config?.etiqueta_assunto ?? "ENTREGA"}]`;
  const exemploAssunto = `${etiqueta} ${v.etapa} 1 - ${v.grupo} Azul`;

  return (
    <div className="flex max-w-2xl flex-col gap-4">
    <div>
      <h1 className="text-2xl font-bold">Receber por e-mail</h1>
      <p className="text-sm text-suave">Tudo salva sozinho.</p>
    </div>
    <Cartao id="recebimento" className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Endereço{varias && turma ? ` · ${turma.nome}` : ""}</h2>
        <p className="text-sm text-suave">
          Quem entrega não usa o Handback: manda um e-mail para o endereço abaixo, com o assunto começando por{" "}
          <strong>{etiqueta}</strong>. O Handback separa por {v.etapa.toLowerCase()} e {v.grupo.toLowerCase()} sozinho.
          Ninguém precisa configurar nada.
        </p>
      </div>
      {endereco ? (
        <EnderecoDaTurma endereco={endereco} etiqueta={etiqueta} exemploAssunto={exemploAssunto} />
      ) : (
        <Aviso tipo="alerta">
          O serviço de recebimento de e-mails ainda não foi ligado ao Handback. Quando for, o endereço de cada turma aparece aqui.
        </Aviso>
      )}
      {endereco ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-marca-forte">
            Opcional: receber no seu Gmail e encaminhar para o Handback
          </summary>
          <p className="mt-2 text-suave">
            Só se você preferir que as entregas cheguem primeiro no seu e-mail. Leva uns 5 minutos, uma vez só.
          </p>
          <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5">
            <li>
              No Gmail, abra <strong>Configurações (engrenagem) › Ver todas as configurações › Encaminhamento e POP/IMAP</strong>{" "}
              e toque em <strong>Adicionar um endereço de encaminhamento</strong>. Cole o endereço acima.
            </li>
            <li>
              O Gmail manda um código de confirmação para o Handback. Ele aparece em{" "}
              <strong>Entregas › Caixa de e-mails › Para confirmar</strong>. Copie o código e confirme no Gmail.{" "}
              <em>Não</em> ative “encaminhar uma cópia dos e-mails recebidos”.
            </li>
            <li>
              Na busca do Gmail, digite <code>subject:{config?.etiqueta_assunto ?? "ENTREGA"}</code>, abra as opções da busca e
              toque em <strong>Criar filtro</strong>. Marque <strong>Encaminhar para</strong>, escolha o endereço do Handback e
              toque em <strong>Criar filtro</strong>.
            </li>
          </ol>
        </details>
      ) : null}
    </Cartao>

    <Cartao className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Triagem dos e-mails</h2>
      <CampoAuto slug={slug} campo="etiqueta_assunto" rotulo="Etiqueta no começo do assunto" valor={config?.etiqueta_assunto ?? "ENTREGA"} maximo={40} dica="Sem colchetes. Ex.: ENTREGA → os assuntos começam com [ENTREGA]." />
      <CampoAuto
        slug={slug}
        campo="modo_entrega"
        rotulo="E-mails fora do padrão, mas com anexo ou link"
        tipo="escolha"
        valor={config?.modo_entrega ?? "confirmar"}
        opcoes={[
          { valor: "confirmar", nome: "Vão para “Para confirmar” (recomendado)" },
          { valor: "automatico", nome: "Viram entrega direto (modo automático)" },
        ]}
      />
      <CampoAuto
        slug={slug}
        campo="assuntos_ignorar"
        rotulo="Assuntos que nunca são entrega"
        tipo="area"
        linhas={2}
        maximo={2000}
        valor={config?.assuntos_ignorar ?? ""}
        dica="Palavras separadas por vírgula. E-mails com elas no assunto (e sem a etiqueta) são ignorados e os anexos NÃO são guardados — use para documentos pessoais."
      />
    </Cartao>
    </div>
  );
}

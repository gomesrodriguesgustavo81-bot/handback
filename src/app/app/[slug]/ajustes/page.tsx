import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormAcao } from "@/components/form-acao";
import { AreaTexto, Aviso, Campo, Cartao, Escolha } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { EnderecoDaTurma } from "@/components/endereco-turma";
import { enderecoDeRecebimento } from "@/lib/emails/endereco";
import { criarClienteServidor } from "@/lib/supabase/server";
import { salvarAjustes } from "./acoes";
import { ROTULO_REGRA, type RegraChecklist } from "@/lib/ia/regras";

export const metadata: Metadata = { title: "Ajustes" };

export default async function Ajustes({ params }: PageProps<"/app/[slug]/ajustes">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const v = empresa.vocabulario;
  const supabase = await criarClienteServidor();
  const { data: config } = await supabase
    .from("organizacoes")
    .select("caixa_token, etiqueta_assunto, modo_entrega, assuntos_ignorar, conceitos, regra_checklist, exemplos_devolutiva, enviar_conceito")
    .eq("id", empresa.id)
    .single();
  const endereco = config ? enderecoDeRecebimento(config.caixa_token) : null;
  const etiqueta = `[${config?.etiqueta_assunto ?? "ENTREGA"}]`;
  const exemploAssunto = `${etiqueta} ${v.etapa} 1 - ${v.grupo} Azul`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
    <Cartao className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Recebimento por e-mail</h2>
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
          O serviço de recebimento de e-mails ainda não foi ligado ao Handback. Quando for, o endereço desta empresa aparece aqui.
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
      <h2 className="text-lg font-semibold">Ajustes da empresa</h2>
      <FormAcao acao={salvarAjustes.bind(null, slug)} textoBotao="Salvar ajustes">
        <Campo rotulo="Nome da empresa" name="nome" required defaultValue={empresa.nome} />
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-medium">Palavras usadas no dia a dia</legend>
          <p className="text-sm text-suave">
            Troque pelas palavras que as pessoas daqui usam. Elas aparecem nos menus, nas telas e, depois, nos e-mails.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Etapa (uma)" name="etapa" required defaultValue={v.etapa} dica="Ex.: Aula, Ciclo, Encontro" />
            <Campo rotulo="Etapas (várias)" name="etapas" required defaultValue={v.etapas} />
            <Campo rotulo="Quem avalia (um)" name="avaliador" required defaultValue={v.avaliador} dica="Ex.: Professor, Gestor" />
            <Campo rotulo="Quem avalia (vários)" name="avaliadores" required defaultValue={v.avaliadores} />
            <Campo rotulo="Quem entrega (um)" name="grupo" required defaultValue={v.grupo} dica="Ex.: Equipe, Time, Cliente" />
            <Campo rotulo="Quem entrega (vários)" name="grupos" required defaultValue={v.grupos} />
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-medium">Triagem dos e-mails</legend>
          <Campo
            rotulo="Etiqueta no começo do assunto"
            name="etiqueta_assunto"
            required
            defaultValue={config?.etiqueta_assunto ?? "ENTREGA"}
            dica="Sem colchetes. Ex.: ENTREGA → os assuntos começam com [ENTREGA]."
          />
          <Escolha
            rotulo="E-mails fora do padrão, mas com anexo ou link"
            name="modo_entrega"
            defaultValue={config?.modo_entrega ?? "confirmar"}
            opcoes={[
              { valor: "confirmar", nome: "Vão para “Para confirmar” (recomendado)" },
              { valor: "automatico", nome: "Viram entrega direto (modo automático)" },
            ]}
          />
          <AreaTexto
            rotulo="Assuntos que nunca são entrega"
            name="assuntos_ignorar"
            rows={2}
            defaultValue={config?.assuntos_ignorar ?? ""}
            dica="Palavras separadas por vírgula. E-mails com elas no assunto (e sem a etiqueta) são ignorados e os anexos NÃO são guardados — use para documentos pessoais."
          />
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-medium">Avaliação com IA</legend>
          <p className="text-sm text-suave">Sem notas: só os quatro conceitos. Descreva o que cada um significa aqui.</p>
          {(["EXCELENTE", "BOM", "REGULAR", "RUIM"] as const).map((c) => (
            <AreaTexto
              key={c}
              rotulo={c}
              name={`conceito_${c}`}
              rows={2}
              required
              defaultValue={(config?.conceitos as Record<string, string> | undefined)?.[c] ?? ""}
            />
          ))}
          <Escolha
            rotulo="Regra do checklist"
            name="regra_checklist"
            defaultValue={config?.regra_checklist ?? "flexivel"}
            opcoes={(Object.keys(ROTULO_REGRA) as RegraChecklist[]).map((r) => ({ valor: r, nome: ROTULO_REGRA[r] }))}
            dica="Uma observação na etapa que cite um conceito (ex.: “se faltar X, no máximo REGULAR”) sempre tem prioridade."
          />
          <AreaTexto
            rotulo="Exemplos de devolutivas aprovadas (opcional)"
            name="exemplos_devolutiva"
            rows={6}
            defaultValue={config?.exemplos_devolutiva ?? ""}
            dica="A IA imita o tom e o tamanho destes exemplos. Separe um do outro com uma linha só com ---. Se ficar vazio, ela usa as últimas devolutivas aprovadas aqui no Handback."
          />
          <Escolha
            rotulo="No e-mail da devolutiva"
            name="enviar_conceito"
            defaultValue={config?.enviar_conceito === false ? "nao" : "sim"}
            opcoes={[
              { valor: "sim", nome: "Mandar o conceito e o checklist junto com o texto" },
              { valor: "nao", nome: "Mandar só o texto (conceito e checklist ficam só no Handback)" },
            ]}
          />
        </fieldset>
      </FormAcao>
    </Cartao>
    </div>
  );
}

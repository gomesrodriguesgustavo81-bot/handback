import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormAcao } from "@/components/form-acao";
import { AreaTexto, Aviso, Campo, Cartao, Escolha } from "@/components/ui";
import { contextoDaEmpresa } from "@/lib/empresa";
import { EnderecoDaTurma } from "@/components/endereco-turma";
import { enderecoDeRecebimento } from "@/lib/emails/endereco";
import { criarClienteServidor } from "@/lib/supabase/server";
import { criarTurma, salvarAjustes, salvarTurma } from "./acoes";
import { completarVocabulario, o } from "@/lib/nomes";
import { turmaAtual, turmasDaEmpresa } from "@/lib/turma";
import { ROTULO_REGRA, type RegraChecklist } from "@/lib/ia/regras";

export const metadata: Metadata = { title: "Ajustes" };

export default async function Ajustes({ params }: PageProps<"/app/[slug]/ajustes">) {
  const { slug } = await params;
  const { empresa, podeGerir } = await contextoDaEmpresa(slug);
  if (!podeGerir) notFound();
  const v = empresa.vocabulario;
  const vc = completarVocabulario(v);
  const supabase = await criarClienteServidor();
  const [turmas, turma] = await Promise.all([turmasDaEmpresa(empresa.id), turmaAtual(empresa.id)]);
  const { data: config } = await supabase
    .from("organizacoes")
    .select("caixa_token, etiqueta_assunto, modo_entrega, assuntos_ignorar, conceitos, regra_checklist, exemplos_devolutiva, enviar_conceito, exigir_duas_etapas")
    .eq("id", empresa.id)
    .single();
  const endereco = turma ? enderecoDeRecebimento(turma.caixa_token) : null;
  const etiqueta = `[${config?.etiqueta_assunto ?? "ENTREGA"}]`;
  const exemploAssunto = `${etiqueta} ${v.etapa} 1 - ${v.grupo} Azul`;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
    <Cartao id="recebimento" className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Recebimento por e-mail{turmas.length > 1 && turma ? ` · ${turma.nome}` : ""}</h2>
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

    <Cartao id="turmas" className="flex scroll-mt-6 flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">{vc.espacos}</h2>
        <p className="text-sm text-suave">
          Cada {vc.espaco.toLowerCase()} tem {o(vc, "etapa", true)} {vc.etapas.toLowerCase()}, {vc.grupos.toLowerCase()} ou {vc.pessoas.toLowerCase()} e o
          endereço de e-mail próprios. Os ajustes abaixo valem para todas.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {turmas.map((t) => (
          <li key={t.id} className="rounded-xl border border-borda p-3">
            <FormAcao acao={salvarTurma.bind(null, slug, t.id)} textoBotao="Salvar">
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Nome" name="nome" required defaultValue={t.nome} />
                <Escolha
                  rotulo="Quem entrega"
                  name="modo"
                  defaultValue={t.modo}
                  opcoes={[
                    { valor: "grupos", nome: `${vc.grupos} (com ${vc.pessoas.toLowerCase()} dentro)` },
                    { valor: "individual", nome: `${vc.pessoas} individualmente` },
                  ]}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="arquivada" defaultChecked={t.arquivada} className="size-5" />
                Arquivada (some do topo, mas nada é apagado)
              </label>
            </FormAcao>
          </li>
        ))}
      </ul>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-marca-forte">+ Criar {vc.espaco.toLowerCase()}</summary>
        <div className="mt-3">
          <FormAcao acao={criarTurma.bind(null, slug)} textoBotao="Criar" limparAoSalvar>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome" name="nome" required placeholder="Ex.: Cálculo II — Manhã" />
              <Escolha
                rotulo="Quem entrega"
                name="modo"
                defaultValue={turma?.modo ?? "grupos"}
                opcoes={[
                  { valor: "grupos", nome: `${vc.grupos} (com ${vc.pessoas.toLowerCase()} dentro)` },
                  { valor: "individual", nome: `${vc.pessoas} individualmente` },
                ]}
              />
            </div>
          </FormAcao>
        </div>
      </details>
    </Cartao>

    <Cartao className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Ajustes da empresa</h2>
      <FormAcao acao={salvarAjustes.bind(null, slug)} textoBotao="Salvar ajustes">
        <Campo rotulo="Nome da empresa" name="nome" required defaultValue={empresa.nome} />
        <fieldset id="nomes" className="flex scroll-mt-6 flex-col gap-3">
          <legend className="mb-1 font-medium">Palavras usadas no dia a dia</legend>
          <p className="text-sm text-suave">
            Troque pelas palavras que as pessoas daqui usam. Elas aparecem nos menus, nas telas e, depois, nos e-mails.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Turma, programa ou projeto" name="espaco" required defaultValue={vc.espaco} dica={`Plural: ${vc.espacos}. Ex.: Turma, Programa, Projeto`} />
            <Campo rotulo="Etapa de entrega" name="etapa" required defaultValue={vc.etapa} dica={`Plural: ${vc.etapas}. Ex.: Aula, Ciclo, Sprint`} />
            <Campo rotulo="Grupo que entrega" name="grupo" required defaultValue={vc.grupo} dica={`Plural: ${vc.grupos}. Ex.: Equipe, Time, Grupo`} />
            <Campo rotulo="Pessoa (dentro do grupo ou individual)" name="pessoa" required defaultValue={vc.pessoa} dica={`Plural: ${vc.pessoas}. Ex.: Aluno, Residente`} />
            <Campo rotulo="Quem avalia" name="avaliador" required defaultValue={vc.avaliador} dica={`Plural: ${vc.avaliadores}. Ex.: Professor, Gestor`} />
          </div>
          <p className="text-xs text-suave">Escreva só no singular: o plural é feito sozinho.</p>
        </fieldset>
        <fieldset id="seguranca" className="flex scroll-mt-6 flex-col gap-3">
          <legend className="mb-1 font-medium">Segurança</legend>
          <Escolha
            rotulo="Verificação em duas etapas (senha + código do celular)"
            name="exigir_duas_etapas"
            defaultValue={config?.exigir_duas_etapas === false ? "nao" : "sim"}
            opcoes={[
              { valor: "sim", nome: "Obrigatória para todos (recomendado)" },
              { valor: "nao", nome: "Opcional (cada pessoa decide)" },
            ]}
            dica="Com ela, mesmo quem descobrir a senha de alguém não consegue ver os documentos da empresa."
          />
        </fieldset>
        <fieldset id="triagem" className="flex scroll-mt-6 flex-col gap-3">
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
        <fieldset id="avaliacao" className="flex scroll-mt-6 flex-col gap-3">
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

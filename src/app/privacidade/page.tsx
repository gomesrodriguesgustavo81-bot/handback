import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Marca } from "@/components/marca";
import { contato, Rodape } from "@/components/rodape";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como o Handback trata os dados das empresas, das entregas e da conta do Google de quem avalia.",
};

const ATUALIZADA = "23 de novembro de 2026";

function Secao({ id, titulo, children }: { id?: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-3">
      <h2 className="text-xl font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

export default function Privacidade() {
  const email = contato();
  const falar = email ? (
    <a href={`mailto:${email}`} className="font-medium text-marca-forte underline">
      {email}
    </a>
  ) : (
    "o e-mail de suporte do Handback"
  );
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
        <Marca />
        <Link href="/" className="text-sm font-medium text-marca-forte hover:underline">
          Início
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pb-16 pt-6 leading-relaxed sm:px-6 [&_li]:ml-5 [&_li]:list-disc [&_p]:text-texto [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Política de privacidade</h1>
          <p className="text-sm text-suave">Atualizada em {ATUALIZADA}</p>
          <p>
            O Handback é um sistema para receber entregas (trabalhos, relatórios, documentos), conferir com ajuda de
            inteligência artificial o que foi pedido e devolver uma avaliação aprovada por uma pessoa. Esta página explica,
            em linguagem simples, quais dados tratamos, para quê, com quem compartilhamos e como você pode exercer seus
            direitos, conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
          </p>
        </div>

        <Secao titulo="1. Quem é quem">
          <p>
            Cada empresa, escola ou escritório que contrata o Handback decide o que é recebido e avaliado: ela é a
            <strong> controladora</strong> dos dados das suas entregas e das pessoas que cadastra. O Handback atua como
            <strong> operador</strong>, tratando esses dados só para prestar o serviço contratado. Para a conta de quem usa
            o sistema (login e conexão com o Gmail), o Handback é o controlador.
          </p>
        </Secao>

        <Secao titulo="2. Quais dados tratamos">
          <ul>
            <li>
              <strong>Conta de acesso:</strong> o e-mail usado para entrar (o login é feito por um link enviado ao e-mail,
              sem senha) e o papel da pessoa em cada empresa.
            </li>
            <li>
              <strong>Cadastros da empresa:</strong> nome da empresa, etapas (aulas, ciclos, encontros), equipes e nomes e
              e-mails de quem entrega.
            </li>
            <li>
              <strong>Entregas:</strong> e-mails encaminhados para o endereço de recebimento da empresa (remetente, assunto,
              texto, links e anexos) e entregas registradas à mão. Os arquivos ficam numa área privada; só quem avalia na
              empresa consegue abri-los, por links que expiram.
            </li>
            <li>
              <strong>Avaliações:</strong> o checklist do que foi pedido, o conceito (EXCELENTE, BOM, REGULAR, RUIM ou
              PENDENTE, nunca nota), a análise interna, a devolutiva e o registro de quando e para quem ela foi enviada.
            </li>
            <li>
              <strong>Conexão com o Gmail</strong> (opcional, só de quem avalia): o endereço da conta conectada e uma
              autorização do Google guardada de forma cifrada. Detalhes na seção 5.
            </li>
          </ul>
          <p>
            E-mails que não são entrega (conversas, agradecimentos) e documentos pessoais (como RG, CPF ou comprovantes)
            são reconhecidos e ignorados: os anexos deles não são guardados e nunca são enviados para a inteligência
            artificial.
          </p>
        </Secao>

        <Secao titulo="3. Para que usamos">
          <ul>
            <li>Organizar as entregas por empresa, etapa e equipe e mostrar o andamento a quem avalia;</li>
            <li>Conferir com inteligência artificial o que foi entregue e sugerir um conceito e um rascunho de devolutiva;</li>
            <li>Permitir que uma pessoa revise, aprove e envie a devolutiva à equipe;</li>
            <li>Gerar relatórios para a própria empresa e manter a segurança do sistema.</li>
          </ul>
          <p>
            Não vendemos dados, não usamos dados para publicidade e não criamos perfis para outras finalidades. Nenhuma
            devolutiva é enviada sem a aprovação de uma pessoa.
          </p>
        </Secao>

        <Secao titulo="4. Inteligência artificial">
          <p>
            Para analisar uma entrega, o Handback envia o texto, os arquivos e os links públicos dela, junto com o que foi
            pedido, para a API do Gemini, do Google, usando uma conta paga. Nessa modalidade, o Google não usa o conteúdo
            enviado para treinar ou melhorar os modelos dele. A análise só acontece quando alguém da empresa pede.
          </p>
        </Secao>

        <Secao id="google" titulo="5. Dados da sua Conta do Google (Gmail)">
          <p>
            Quem avalia pode conectar a própria conta do Gmail para que a devolutiva aprovada saia do seu e-mail. Nesse
            caso:
          </p>
          <ul>
            <li>
              <strong>Permissão pedida:</strong> apenas <code>gmail.send</code> (enviar e-mails em seu nome) e o seu
              endereço de e-mail, para mostrar qual conta está conectada. O Handback <strong>não lê, não apaga, não
              organiza e não guarda</strong> nenhuma mensagem da sua caixa de entrada.
            </li>
            <li>
              <strong>Quando usamos:</strong> somente quando você toca em “Enviar” (ou “Enviar as aprovadas”) para
              devolutivas que você mesmo aprovou. O e-mail vai para as pessoas da equipe cadastradas pela sua empresa e
              para quem mandou a entrega, e você vê os destinatários antes de enviar.
            </li>
            <li>
              <strong>Como guardamos:</strong> a autorização do Google fica cifrada (AES-256) no nosso banco de dados e só o
              servidor do Handback consegue usá-la. Ela nunca aparece no navegador.
            </li>
            <li>
              <strong>Com quem compartilhamos:</strong> com ninguém. Os dados recebidos do Google não são vendidos, não são
              usados para publicidade, não são usados para treinar inteligência artificial e não são lidos por pessoas,
              exceto se você pedir ajuda ao suporte ou se a lei exigir.
            </li>
            <li>
              <strong>Como desconectar:</strong> use “Desconectar” no painel de entregas do Handback (apagamos a
              autorização e avisamos o Google) ou remova o acesso em{" "}
              <a href="https://myaccount.google.com/permissions" className="font-medium text-marca-forte underline">
                myaccount.google.com/permissions
              </a>
              .
            </li>
          </ul>
          <p className="rounded-xl border border-borda bg-cartao p-4 text-sm">
            O uso e a transferência, pelo Handback, de informações recebidas das APIs do Google para qualquer outro
            aplicativo seguem a{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="font-medium text-marca-forte underline"
            >
              Política de Dados do Usuário dos Serviços de API do Google
            </a>
            , incluindo os requisitos de Uso Limitado.
            <br />
            <span lang="en">
              Handback&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="font-medium text-marca-forte underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </span>
          </p>
        </Secao>

        <Secao titulo="6. Com quem compartilhamos">
          <p>Usamos fornecedores que tratam dados só para fazer o Handback funcionar:</p>
          <ul>
            <li>
              <strong>Supabase</strong>: banco de dados, login e armazenamento privado dos arquivos;
            </li>
            <li>
              <strong>Vercel</strong>: hospedagem do site;
            </li>
            <li>
              <strong>Google</strong>: análise com inteligência artificial (Gemini) e envio pelo Gmail de quem conectou;
            </li>
            <li>
              <strong>Serviço de recebimento de e-mails</strong>: entrega ao Handback os e-mails encaminhados pela empresa.
            </li>
          </ul>
          <p>Alguns desses fornecedores podem guardar dados fora do Brasil, sempre com proteções contratuais.</p>
        </Secao>

        <Secao titulo="7. Por quanto tempo guardamos">
          <p>
            Guardamos os dados enquanto a empresa usar o Handback. Quando a empresa encerra o uso ou pede, apagamos os
            dados dela, exceto o que a lei mandar guardar. A conexão com o Gmail é apagada assim que você desconecta.
          </p>
        </Secao>

        <Secao titulo="8. Segurança">
          <p>
            Cada empresa só enxerga os próprios dados (regras de acesso no próprio banco de dados), os arquivos ficam numa
            área privada, as conexões são criptografadas (HTTPS) e as chaves de acesso ficam só no servidor. O acesso exige
            senha forte e, por padrão, verificação em duas etapas.
          </p>
          <p>
            <strong>Registro de atividades:</strong> para a segurança das empresas, o Handback registra acessos (data, hora,
            endereço IP e tipo de aparelho) e ações importantes, como abrir uma entrega, baixar um arquivo, aprovar ou enviar uma
            devolutiva e convidar pessoas. O administrador da empresa vê o registro da empresa, e cada pessoa vê os próprios
            acessos em “Minha conta”. O registro não pode ser alterado nem apagado por ninguém e é guardado enquanto a empresa
            usar o Handback.
          </p>
        </Secao>

        <Secao titulo="9. Seus direitos">
          <p>
            Você pode pedir para confirmar se tratamos seus dados, acessar, corrigir, apagar, levar para outro serviço, saber
            com quem compartilhamos e revogar consentimentos. Se você entregou um trabalho por meio de uma empresa ou
            escola, fale primeiro com ela, que é quem decide sobre esses dados; nós ajudamos no que for preciso.
          </p>
        </Secao>

        <Secao titulo="10. Contato">
          <p>Dúvidas ou pedidos sobre privacidade: {falar}.</p>
          <p className="text-sm text-suave">
            Podemos atualizar esta política; a data no topo mostra a versão em vigor. Mudanças importantes serão avisadas
            dentro do Handback.
          </p>
        </Secao>
      </main>
      <Rodape />
    </div>
  );
}

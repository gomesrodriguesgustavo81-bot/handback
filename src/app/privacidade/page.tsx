import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Marca } from "@/components/marca";
import { contato, Rodape } from "@/components/rodape";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como o Handback trata os dados das turmas, das entregas e das contas do Google e do Moodle de quem avalia.",
};

const ATUALIZADA = "27 de novembro de 2026";

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
            O Handback é um sistema para professores e equipes receberem entregas (trabalhos, relatórios, projetos,
            documentos), conferirem com ajuda de inteligência artificial o que foi pedido e devolverem uma avaliação sempre
            aprovada por uma pessoa. Esta página explica,
            em linguagem simples, quais dados tratamos, para quê, com quem compartilhamos e como você pode exercer seus
            direitos, conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
          </p>
        </div>

        <Secao titulo="1. Quem é quem">
          <p>
            Quem usa o Handback para avaliar (o professor, a escola, a empresa ou o escritório) decide o que é recebido e
            avaliado: é o <strong>controlador</strong> dos dados das entregas e das pessoas que cadastra ou que vêm do Google
            Classroom ou do Moodle. O Handback atua como <strong>operador</strong>, tratando esses dados só para prestar o
            serviço. Para a conta de quem usa o sistema (login e contas conectadas), o Handback é o controlador.
          </p>
        </Secao>

        <Secao titulo="2. Quais dados tratamos">
          <ul>
            <li>
              <strong>Conta de acesso:</strong> nome, e-mail, senha (guardada só de forma cifrada, nunca em texto) ou login
              com a Conta do Google, a verificação em duas etapas e o papel da pessoa em cada espaço.
            </li>
            <li>
              <strong>Cadastros:</strong> turmas, etapas (aulas, entregas, encontros), equipes e nomes e e-mails de quem
              entrega, digitados por quem avalia ou trazidos do Google Classroom ou do Moodle.
            </li>
            <li>
              <strong>Entregas:</strong> e-mails enviados ao endereço de recebimento da turma (remetente, assunto, texto,
              links e anexos), entregas trazidas do Google Classroom ou do Moodle e entregas registradas à mão. Os arquivos
              ficam numa área privada; só quem avalia consegue abri-los, por links que expiram.
            </li>
            <li>
              <strong>Avaliações:</strong> o checklist do que foi pedido, o conceito (EXCELENTE, BOM, REGULAR ou RUIM), a
              nota correspondente quando quem avalia configura uma (para lançar no Classroom ou no Moodle), a análise
              interna, a devolutiva e o registro de quando e para onde ela foi enviada.
            </li>
            <li>
              <strong>Contas conectadas</strong> (opcionais, só de quem avalia): Gmail, Google Drive, Google Agenda, Google
              Classroom e Moodle. Guardamos o endereço da conta e uma autorização cifrada. Detalhes nas seções 5 e 6.
            </li>
            <li>
              <strong>Avisos no celular</strong> (opcional): se você ligar, guardamos o endereço técnico do seu aparelho
              para mandar os avisos do Handback. Desligar apaga esse endereço.
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
            <li>Organizar as entregas por turma, etapa e equipe e mostrar o andamento a quem avalia;</li>
            <li>Conferir com inteligência artificial o que foi entregue e sugerir um conceito e um rascunho de devolutiva;</li>
            <li>Permitir que uma pessoa revise, aprove e envie a devolutiva (por e-mail, no Google Classroom ou no Moodle);</li>
            <li>Mandar lembretes de prazo aos alunos, quando quem avalia liga essa opção, e avisos para quem avalia;</li>
            <li>Avisar quando duas entregas da mesma etapa estão parecidas demais (a decisão é sempre de quem avalia);</li>
            <li>Gerar relatórios para quem avalia e manter a segurança do sistema.</li>
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
            enviado para treinar ou melhorar os modelos dele. A análise acontece quando quem avalia pede ou, se ele ligar o
            “piloto automático” de uma turma, assim que a entrega chega. Em todos os casos, nada vai para o aluno sem a
            aprovação de uma pessoa. Documentos pessoais reconhecidos (como RG ou CPF) nunca são enviados para a IA.
          </p>
          <p>
            A IA só prepara um rascunho e sugere um conceito: quem decide o conceito e assina a devolutiva é o professor, e
            a conta pode exigir que ele escolha o conceito, ou que a IA nem sugira um. Antes de enviar o texto, o Handback
            troca o nome do aluno ou da equipe por um código e esconde e-mail, telefone e CPF (as duas proteções vêm ligadas
            e quem administra a conta pode mudá-las). PDFs e imagens vão inteiros, porque não dá para apagar dados de dentro
            deles; por isso, quando o Handback encontra telefone ou CPF num trabalho, avisa o professor. O Google pode
            guardar os pedidos por um período limitado, só para detectar abuso, conforme a política dele. O Handback
            guarda, para o professor, o que a IA sugeriu, o que ele decidiu e quando (registro de supervisão).
          </p>
        </Secao>

        <Secao id="google" titulo="5. Dados da sua Conta do Google">
          <p>
            Cada professor conecta só a própria conta, e só o que quiser usar. Cada serviço pede o mínimo necessário:
          </p>
          <ul>
            <li>
              <strong>Gmail</strong> (<code>gmail.send</code>): enviar, em seu nome, as devolutivas que você aprovou e os
              lembretes de prazo que você ligou. O Handback <strong>não lê, não apaga, não organiza e não guarda</strong>{" "}
              nenhuma mensagem da sua caixa de entrada. Você vê os destinatários antes de enviar.
            </li>
            <li>
              <strong>Google Drive</strong> (<code>drive.file</code>): criar uma pasta para guardar os arquivos das entregas.
              O Handback só enxerga as pastas e arquivos que ele mesmo criou ou que você escolheu; o resto do seu Drive fica
              fechado para ele.
            </li>
            <li>
              <strong>Google Agenda</strong> (<code>calendar.app.created</code>): criar uma agenda só com os prazos das suas
              turmas. O Handback não vê os seus outros compromissos.
            </li>
            <li>
              <strong>Google Classroom</strong>: ver as suas turmas e a lista de alunos com e-mail
              (<code>classroom.courses.readonly</code>, <code>classroom.rosters.readonly</code>,{" "}
              <code>classroom.profile.emails</code>), ler e criar tarefas e lançar a nota que você aprovou
              (<code>classroom.coursework.students</code>), e baixar só os arquivos dos alunos que você escolher na janela do
              Google (<code>drive.file</code>).
            </li>
            <li>
              <strong>Login com o Google</strong>: só o seu nome e e-mail, para entrar no Handback.
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
              <strong>Como desconectar:</strong> use “Desconectar” em Contas conectadas, no Handback (apagamos a
              autorização e avisamos o Google), ou remova o acesso em{" "}
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

        <Secao id="moodle" titulo="6. Moodle">
          <p>
            Quem avalia pode ligar uma disciplina do Moodle da própria instituição. Guardamos o endereço do Moodle e uma
            chave de acesso cifrada (AES-256). Com ela, o Handback lê as disciplinas, a lista de alunos e grupos, as tarefas e
            as entregas, e publica o comentário e a nota que você aprovou. Para desligar, use Contas conectadas; a chave é
            apagada na hora.
          </p>
        </Secao>

        <Secao titulo="7. Crianças e adolescentes">
          <p>
            Muitos alunos têm menos de 18 anos. Por isso, os dados deles só entram no Handback por meio de quem avalia (o
            professor ou a escola), que é responsável por tratá-los no melhor interesse do aluno, conforme o artigo 14 da
            LGPD. O Handback usa esses dados só para a avaliação, nunca para publicidade ou perfis.
          </p>
        </Secao>

        <Secao titulo="8. Com quem compartilhamos">
          <p>Usamos fornecedores que tratam dados só para fazer o Handback funcionar:</p>
          <ul>
            <li>
              <strong>Supabase</strong>: banco de dados, login e armazenamento privado dos arquivos;
            </li>
            <li>
              <strong>Vercel</strong>: hospedagem do site;
            </li>
            <li>
              <strong>Google</strong>: análise com inteligência artificial (Gemini) e os serviços que você conectou (Gmail,
              Drive, Agenda, Classroom);
            </li>
            <li>
              <strong>Resend</strong>: recebe os e-mails enviados aos endereços das turmas e envia os e-mails do próprio
              Handback (como convites);
            </li>
            <li>
              <strong>O Moodle da sua instituição</strong>, quando você liga uma disciplina.
            </li>
          </ul>
          <p>Alguns desses fornecedores podem guardar dados fora do Brasil, sempre com proteções contratuais.</p>
        </Secao>

        <Secao titulo="9. Por quanto tempo guardamos">
          <p>
            Guardamos os dados enquanto a empresa usar o Handback. Quando a empresa encerra o uso ou pede, apagamos os
            dados dela, exceto o que a lei mandar guardar. Cada conta conectada (Google ou Moodle) é apagada assim que você
            desconecta.
          </p>
        </Secao>

        <Secao titulo="10. Segurança">
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

        <Secao titulo="11. Seus direitos">
          <p>
            Você pode pedir para confirmar se tratamos seus dados, acessar, corrigir, apagar, levar para outro serviço, saber
            com quem compartilhamos e revogar consentimentos. Se você entregou um trabalho por meio de uma empresa ou
            escola, fale primeiro com ela, que é quem decide sobre esses dados; nós ajudamos no que for preciso.
          </p>
        </Secao>

        <Secao id="cookies" titulo="12. Cookies e aceite dos termos">
          <p>
            Usamos só cookies necessários para o site funcionar (manter você conectado, lembrar a turma escolhida e o tema
            claro ou escuro). Não usamos cookies de anúncio nem de rastreamento. A lista completa está na{" "}
            <Link href="/cookies" className="font-medium text-marca-forte underline">
              página de cookies
            </Link>
            .
          </p>
          <p>
            Ao criar a conta você aceita os Termos de uso e esta política. Guardamos a data, a versão que você aceitou e, no
            cadastro pela internet, uma marca embaralhada do endereço de rede (não o endereço em si), para comprovar o aceite.
          </p>
        </Secao>

        <Secao titulo="13. Contato">
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

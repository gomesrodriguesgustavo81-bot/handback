# Como colocar o Handback no ar

Este é o passo a passo para quem **não é programador**. Leva cerca de 30 minutos
na primeira vez. Todas as contas ficam no **seu nome**, porque o negócio é seu.

---

## Parte 1 · Banco de dados e login (Supabase)

1. Acesse **supabase.com** e crie uma conta (pode entrar com o GitHub).
2. Toque em **New project**:
   - **Name:** `handback`
   - **Database Password:** crie uma senha forte e **guarde num lugar seguro**.
   - **Region:** **South America (São Paulo)**, para os dados ficarem no Brasil.
3. Espere o projeto ficar pronto (1 a 2 minutos).
4. Crie as tabelas:
   - No menu da esquerda, abra **SQL Editor** › **New query**.
   - Abra no GitHub o arquivo `supabase/migrations/20261122000000_fundacao.sql`,
     copie **todo** o conteúdo e cole no editor.
   - Toque em **Run**. Deve aparecer "Success".
5. Anote os dois dados de acesso, em **Project Settings › API Keys** (ou **API**):
   - **Project URL** (algo como `https://abcd.supabase.co`)
   - **Publishable key** (começa com `sb_publishable_`). Se só aparecer a
     "anon public", use essa.

> ⚠️ **Nunca** use nem compartilhe a chave **secret** / **service_role**. O Handback não precisa dela.

---

## Parte 2 · Colocar o site no ar (Vercel)

1. Acesse **vercel.com** e crie uma conta **entrando com o GitHub**.
2. Toque em **Add New… › Project** e escolha o repositório **handback**.
3. Em **Environment Variables**, cadastre:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | o Project URL da Parte 1 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | a Publishable key da Parte 1 |

   Se você ligou o Supabase pela própria Vercel (integração), ela já cria variáveis
   como `SUPABASE_URL` e `SUPABASE_ANON_KEY`, e o Handback também aceita esses nomes.
   Nunca cadastre a chave **secret** / **service_role** com outro nome.
4. Toque em **Deploy** e espere terminar. A Vercel mostra o endereço do site,
   por exemplo `https://handback.vercel.app`.

---

## Parte 3 · Ligar o login ao endereço do site

1. No Supabase, abra **Authentication › URL Configuration**:
   - **Site URL:** o endereço oficial da Vercel, sem nada depois (ex.: `https://handback-six.vercel.app`).
   - **Redirect URLs:** adicione `https://ENDERECO/**` para **cada** endereço que a Vercel mostra
     no projeto (ela costuma criar mais de um, como `handback-six` e `handback-handback`).
2. Ainda no Supabase, abra **Authentication › Emails** e, nas abas **Magic Link** e
   **Confirm signup**, troque o texto do e-mail por:

   ```html
   <h2>Seu acesso ao Handback</h2>
   <p>Toque no link abaixo para entrar. Ele vale por pouco tempo e só pode ser usado uma vez.</p>
   <p><a href="{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=email">Entrar no Handback</a></p>
   ```

   Assim o link funciona em qualquer aparelho ou navegador (o e-mail padrão só
   funciona no mesmo navegador em que o link foi pedido).

---

## Parte 4 · Tornar você o dono da plataforma

1. Abra o site e entre com **o seu e-mail** (você recebe um link, sem senha).
2. No Supabase, abra **SQL Editor** › **New query**, cole o comando abaixo
   **trocando pelo seu e-mail** e toque em **Run**:

   ```sql
   insert into public.administradores_plataforma (user_id)
   select id from auth.users where email = 'SEU-EMAIL-AQUI';
   ```

3. Volte ao site e atualize a página. Vai aparecer **Painel do dono**, onde você
   cria as empresas e convida o administrador de cada uma.

---

## Observações

- **E-mails de login:** no começo, o Supabase envia poucos e-mails por hora
  (servidor de teste). Antes de ter clientes, configure um serviço de e-mail
  próprio em **Authentication › Emails › SMTP Settings**.
- **Atualizações:** cada mudança salva no GitHub (ramo `main`) é publicada
  sozinha pela Vercel.
- **Plano gratuito:** Vercel e Supabase têm planos grátis para testar. Para uso
  comercial com clientes pagando, a Vercel exige o plano pago.

---

## Parte 5 · Ligar a análise com IA (Gemini)

1. Acesse **aistudio.google.com/apikey** e toque em **Create API key**.
2. **Importante (privacidade):** ative o **faturamento** dessa chave no Google AI
   Studio. No plano gratuito, o Google pode usar o conteúdo enviado (trabalhos,
   documentos) para melhorar os produtos dele. Com faturamento, não usa. O custo é de
   centavos por análise.
3. Na Vercel, projeto **handback** › **Settings › Environment Variables**, cadastre:

   | Nome | Valor |
   |---|---|
   | `GEMINI_API_KEY` | a chave criada no passo 1 |
   | `HANDBACK_IA_MODELO` (opcional) | o modelo preferido, ex.: `gemini-flash-latest` |

4. Em **Deployments**, toque nos **⋯** do mais recente › **Redeploy**.

A chave fica só no servidor: nunca aparece no navegador nem no GitHub. Se a cota
de um modelo acabar, o Handback tenta os modelos reserva sozinho.

---

## Parte 6 · Enviar as devolutivas pelo Gmail

Cada pessoa que avalia conecta o **próprio Gmail**. O Handback pede ao Google só a
permissão de **enviar** e-mails (não lê a caixa de ninguém). A devolutiva vai para a
equipe na mesma conversa do e-mail da entrega, com cópia para os integrantes.

Para isso o Handback precisa de um "cadastro de aplicativo" no Google (grátis):

1. Acesse **console.cloud.google.com** com a sua conta Google e crie um projeto
   chamado **Handback** (menu do topo › **Novo projeto**).
2. Em **APIs e serviços › Biblioteca**, procure **Gmail API** e toque em **Ativar**.
3. Em **APIs e serviços › Tela de permissão OAuth** (ou "Google Auth Platform"):
   - Tipo de usuário: **Externo**.
   - Nome do app: **Handback**; e-mail de suporte: o seu.
   - Em **Escopos** (ou "Acesso a dados"), adicione `.../auth/gmail.send`.
   - Em **Usuários de teste** (ou "Público"), adicione o seu Gmail e o de cada
     pessoa que vai usar no piloto (até 100).
4. Em **APIs e serviços › Credenciais › Criar credenciais › ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**.
   - **URIs de redirecionamento autorizados** — adicione os dois:
     - `https://handback-six.vercel.app/api/gmail/retorno`
     - `https://handback-handback.vercel.app/api/gmail/retorno`
   - Toque em **Criar**. Aparecem o **ID do cliente** e a **Chave secreta do cliente**.
5. Na Vercel, projeto **handback** › **Settings › Environment Variables**, cadastre:

   | Nome | Valor |
   |---|---|
   | `GOOGLE_CLIENT_ID` | o ID do cliente (termina em `.apps.googleusercontent.com`) |
   | `GOOGLE_CLIENT_SECRET` | a chave secreta do cliente |

6. Em **Deployments**, toque nos **⋯** do mais recente › **Redeploy**.

Pronto: no painel aparece **Conectar meu Gmail**. Enquanto o app estiver "em teste",
o Google mostra um aviso de "app não verificado" (toque em **Continuar**) e só as
contas cadastradas em "Usuários de teste" conseguem conectar. Para liberar para
qualquer pessoa, peça a **verificação** do app na mesma tela (gratuita; o Google
pode levar alguns dias ou semanas).

A conexão fica guardada **cifrada** no banco e só o servidor consegue lê-la. Se a
chave secreta do Supabase for trocada, cada pessoa precisa conectar o Gmail de novo.
Para desconectar, use **Desconectar** no painel (o Handback também avisa o Google
para apagar a permissão).

---

## Parte 7 · Verificação do Google (liberar o Gmail para qualquer pessoa)

Enquanto o app está "Em teste", só os Gmails cadastrados como usuários de teste
conectam (até 100). Para liberar para todos, o Google precisa verificar o Handback.

**O que o site já tem:** página inicial explicando o uso do Gmail (`/`), política de
privacidade com a declaração de Uso Limitado (`/privacidade`) e termos (`/termos`).

1. **E-mail de contato público.** Na Vercel, cadastre `HANDBACK_CONTATO` com o e-mail
   que vai aparecer na política de privacidade. Faça **Redeploy**.
2. **Comprovar que o site é seu (Google Search Console).**
   - Acesse **search.google.com/search-console** › **Adicionar propriedade** ›
     **Prefixo do URL** › `https://handback-six.vercel.app`.
   - Escolha o método **Tag HTML**. O Google mostra algo como
     `<meta name="google-site-verification" content="CODIGO" />`.
   - Copie só o **CODIGO** e cadastre na Vercel como `GOOGLE_SITE_VERIFICATION`.
     Faça **Redeploy** e depois toque em **Verificar** no Search Console.
3. **Preencher a marca do app** em **console.cloud.google.com › Google Auth Platform ›
   Branding (Desenvolvimento da marca)**:
   - Página inicial: `https://handback-six.vercel.app`
   - Política de privacidade: `https://handback-six.vercel.app/privacidade`
   - Termos de serviço: `https://handback-six.vercel.app/termos`
   - Domínios autorizados: `handback-six.vercel.app`
   - Logo (opcional; com logo o Google faz uma revisão a mais).
4. **Gravar um vídeo curto** (pode ser "não listado" no YouTube) mostrando: entrar no
   Handback, tocar em "Conectar meu Gmail", a tela de permissão do Google com o nome
   Handback e a permissão de enviar e-mails, e uma devolutiva aprovada sendo enviada e
   chegando no e-mail.
5. Em **Google Auth Platform › Público**, toque em **Publicar app** e depois em
   **Verificação** › **Preparar para verificação**. Explique em poucas linhas por que o
   `gmail.send` é necessário (texto sugerido abaixo), cole o link do vídeo e envie.

Texto sugerido para a justificativa (o Google lê em inglês):

> Handback lets teachers and managers review student or team deliverables and send an
> approved written feedback back to the team. With the gmail.send scope, the feedback
> is sent from the reviewer's own Gmail account as a reply in the same thread the team
> used to submit the work, so recipients recognize the sender. The app only sends
> messages that the signed-in user explicitly approved and clicked "Send"; it never
> reads, modifies or deletes mailbox content, so no broader Gmail scope is needed.

A análise costuma levar de alguns dias a algumas semanas. Se o Google pedir para usar
um domínio próprio, compre um (cerca de R$ 40/ano), ligue-o à Vercel e repita os passos
2 e 3 com o domínio novo.

---

## Parte 8 · Acesso seguro (senha + duas etapas + convites)

O Handback agora funciona assim:
- **Só entra quem foi convidado.** O convite chega por e-mail com um link para criar a senha.
- **Senha forte** (12+ caracteres, letras e números, recusa senhas vazadas na internet).
- **Verificação em duas etapas** (código de um app autenticador no celular) obrigatória
  por padrão em toda empresa e sempre para o dono da plataforma. O próprio banco de
  dados esconde os dados de quem não passou pelo código.
- O link de acesso sem senha foi desligado. "Esqueci minha senha" manda um link por e-mail.

### O que configurar no Supabase (uma vez)

1. **Authentication › Sign In / Providers**
   - Desligue **Allow new users to sign up** (ninguém cria conta sozinho; os convites continuam funcionando).
   - Em **Email**, deixe ligado. Em **Password** (ou "Password strength"): tamanho mínimo **12** e
     exigência **Letters and digits**.
2. **Authentication › Multi-Factor**: confira se **TOTP (App Authenticator)** está ativado.
3. **Authentication › Emails › Templates**:
   - **Invite user**: assunto `Você foi convidado para o Handback`; corpo: cole o conteúdo de
     `supabase/templates/convite.html`.
   - **Reset password**: assunto `Handback: criar uma senha nova`; corpo: cole
     `supabase/templates/nova-senha.html`.
4. **Authentication › Emails › SMTP Settings** (recomendado: o envio padrão do Supabase manda
   poucos e-mails por hora). Use o Gmail de suporte do Handback:
   - No Gmail de suporte, ative a **verificação em duas etapas** e crie uma **senha de app**
     (myaccount.google.com › Segurança › Senhas de app).
   - No Supabase: Host `smtp.gmail.com`, Port `465`, Username = o Gmail de suporte,
     Password = a senha de app, Sender name `Handback`, Sender email = o Gmail de suporte.

### Primeiro acesso do dono depois da mudança

Como o link sem senha saiu, entre em **/entrar › Esqueci minha senha** com o seu e-mail,
crie a senha pelo link e ative as duas etapas no celular (o Handback guia o passo a passo).

### Entrar com Google (opcional)

1. No Google Cloud (projeto Handback) › **Credenciais** › o cliente OAuth "Site Handback" ›
   adicione o URI de redirecionamento `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
2. No Supabase › **Authentication › Sign In / Providers › Google**: ative e cole o mesmo
   Client ID e Client Secret.
3. Na Vercel, cadastre `HANDBACK_LOGIN_GOOGLE` = `1` e faça Redeploy.

Quem entra com Google também precisa criar a senha e usar o código das duas etapas.

### Se alguém perder o celular

O administrador da plataforma remove o fator da pessoa no Supabase
(**Authentication › Users** › a pessoa › **Remove MFA factors**). No próximo acesso, ela cadastra o celular novo.

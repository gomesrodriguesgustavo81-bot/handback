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

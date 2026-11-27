# Handback

**Você recebe, a gente devolve conferido.**

O Handback recebe entregas (de equipes, colaboradores ou clientes), confere com IA
o que foi pedido e devolve uma avaliação aprovada por uma pessoa. Cada empresa
cliente tem o seu espaço, separado das outras.

## Situação

| Fase | O que entrega | Situação |
|---|---|---|
| 0 · Fundação | Site, login por e-mail, empresas, membros, convites, painel do dono | Pronta |
| 1 · Cadastros | Etapas (aulas) com checklist, grupos (equipes) com e-mails, pessoas e convites, vocabulário | Pronta |
| 2 · Entregas por e-mail | Recebimento de e-mails encaminhados pelo Gmail de quem avalia, triagem do protótipo, "Para confirmar", quadro de entregas, registro à mão | Pronta (falta ligar o serviço de recebimento: veja [o guia](docs/RECEBIMENTO_DE_EMAILS.md)) |
| 3 · Análise com IA | Checklist item a item, conceito sem nota (regra do checklist configurável), análise interna, rascunho de devolutiva no estilo das aprovadas, evolução do grupo; revisão, aprovação e cópia | Pronta (falta a chave `GEMINI_API_KEY` na Vercel) |
| 4 em diante | Envio das devolutivas por e-mail, relatório da etapa… | A fazer |

## Pastas

| Pasta | O que tem |
|---|---|
| `src/app/` | As telas do site (página inicial, entrar, minhas empresas, painel do dono) |
| `src/lib/` | Regras de acesso e ligação com o banco de dados |
| `supabase/migrations/` | A estrutura do banco de dados (tabelas e regras de quem vê o quê) |
| `supabase/tests/` | Testes das regras de acesso |
| `docs/` | Guias, como o [passo a passo para colocar no ar](docs/COMO_COLOCAR_NO_AR.md) |
| `prototipo/` | O app original em Google Apps Script, que serve de modelo |

## Tecnologia

Next.js (site), Supabase (banco de dados, login e arquivos; o projeto atual está nos Estados Unidos, veja docs/CONFORMIDADE.md)
e Vercel (hospedagem).

## Para programadores

```bash
npm install
cp .env.example .env.local     # preencha com os dados do Supabase
npm run dev                    # http://localhost:3000
npm run typecheck && npm run lint && npm run build
npm test                       # testes da triagem de e-mails e da IA (regras, leitura de arquivos)
npm run test:banco             # testa as regras de acesso num Postgres 16 local
npm run test:e2e               # ponta a ponta (Supabase local + app rodando + node scripts/gemini-falso.mjs + node scripts/google-falso.mjs)
```

Supabase local completo (precisa de Docker): `npx supabase start`. As migrações
em `supabase/migrations/` são aplicadas automaticamente.

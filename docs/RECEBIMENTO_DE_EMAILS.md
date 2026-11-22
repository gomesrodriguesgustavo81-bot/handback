# Recebimento de entregas por e-mail

**Premissa:** quem entrega (aluno, colaborador, cliente) **não usa o Handback**. Ele
manda um e-mail para quem avalia, com o assunto começando por `[ENTREGA]`. O Gmail de
quem avalia encaminha esses e-mails (por um filtro) para o endereço de recebimento da
empresa no Handback, e o Handback faz a triagem.

```
Aluno ──e-mail──▶ Gmail do professor ──filtro "encaminhar"──▶ serviço de recebimento
                                                                     │ (POST JSON)
                                                                     ▼
                                          Handback /api/emails/entrada → triagem
                                          ├─ entrega reconhecida → quadro de Entregas
                                          ├─ fora do padrão      → "Para confirmar"
                                          └─ não é entrega       → ignorado (anexos NÃO guardados)
```

## O que falta para funcionar de verdade

Um **serviço de recebimento de e-mails** que transforme cada e-mail num `POST` JSON
para o Handback. Opções:

- **Com domínio próprio** (ex.: `handback.com.br`, ~R$ 40/ano): Cloudflare Email
  Routing, Resend, Postmark, Mailgun… Endereço final: `entregas+CODIGO@handback.com.br`.
- **Sem domínio, para testes:** serviços que dão um endereço pronto no domínio deles
  (conferir o plano grátis na hora de escolher: limites, tamanho de anexo e se aceitam
  o `+CODIGO` no endereço).

O Handback entende o formato JSON do Postmark (usado por vários serviços) e um formato
próprio simples (veja `src/lib/emails/formatos.ts`). Outro formato = mais uma função ali.

## Configuração (Vercel › Settings › Environment Variables)

| Variável | O que é |
|---|---|
| `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`) | Chave secreta do Supabase. A integração Supabase + Vercel já cria. Fica só no servidor. |
| `HANDBACK_EMAIL_SEGREDO` | Uma senha longa e aleatória (32+ letras e números). |
| `HANDBACK_EMAIL_RECEBIMENTO` | O endereço base do serviço, ex.: `entregas@seu-servico.com`. Cada empresa recebe em `entregas+CODIGO@seu-servico.com` (o código aparece em Ajustes). |

No serviço de recebimento, configure o envio (webhook) para:

```
POST https://SEU-SITE/api/emails/entrada?chave=HANDBACK_EMAIL_SEGREDO
```

## Limites e cuidados

- **Tamanho:** a Vercel aceita até ~4,5 MB por chamada. E-mails com anexos maiores que
  isso precisam de um serviço que mande os anexos como link (ou de um ajuste no
  Handback). Entregas por link do Drive/Figma funcionam sem limite.
- **Privacidade:** e-mails ignorados (ex.: assunto com "bolsista", "contrato",
  "documento") **não têm os anexos guardados**. A lista fica em Ajustes.
- **Duplicados:** o mesmo e-mail chegando duas vezes não vira duas entregas.
- **Segurança:** sem a senha certa, o Handback responde 401 e não grava nada.

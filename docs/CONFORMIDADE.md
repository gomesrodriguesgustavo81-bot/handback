# Handback · Dossiê de conformidade (rascunho)

Documento de trabalho para a instituição, o encarregado de dados e o advogado. **Não é parecer jurídico.**
Cada afirmação está marcada: **[código]** (confirmado no sistema), **[a confirmar]** (precisa de conferência) ou
**[a decidir]** (decisão de negócio ou jurídica pendente). Atualizado em 27/11/2026.

## 1. Quem é quem

- **Controladora:** a instituição, escola ou professor que usa o Handback e decide quais dados dos alunos entram.
- **Operador:** o Handback, que trata os dados só para o que a controladora pede (receber entregas, conferir com IA, devolver).
- O Handback **não usa** os trabalhos nem os dados dos alunos para treinar IA, publicidade ou outro fim próprio. Se um dia
  usasse, passaria a ser controlador desse uso (por isso a promessa vale em contrato e na política de privacidade).

## 2. Que dados são tratados

| Dado | De quem | Para quê | Onde fica |
| --- | --- | --- | --- |
| E-mail, nome, senha (hash), 2ª etapa | Professor e equipe | Entrar e usar a conta | Supabase (login) |
| Nome do espaço, turmas, etapas, checklist, critérios | Instituição | Configurar as avaliações | Supabase |
| Nome e e-mail de alunos (matrícula opcional) | Aluno | Identificar quem entrega e devolver a devolutiva | Supabase |
| Texto do e-mail, arquivos e links da entrega | Aluno | Conferir o que foi pedido | Supabase (arquivos em área privada) |
| Checklist, conceito sugerido, rascunho, alertas | Gerado pela IA | Apoiar o professor | Supabase |
| Conceito final, motivo, quem aprovou e quando | Professor | Decisão e registro de supervisão | Supabase |
| Registro de atividades (ações, IP resumido, aparelho) | Professor | Segurança e prova de quem fez o quê | Supabase |
| Gasto da IA (tokens por análise, sem texto) | Sistema | Custo e limites | Supabase |
| Chaves de acesso do Google do professor (Gmail, Drive, Agenda, Classroom) | Professor | Enviar devolutivas e integrar, só se conectar | Supabase, cifradas **[código]** |

**Dados sensíveis:** o Handback não pede. Mas o **trabalho do aluno pode conter** (saúde, família, religião) sem que ninguém queira.
Por isso existem as proteções da seção 5.

## 3. Bases legais e menores

- A base legal é da **controladora**; o Handback a apoia. Para dados de crianças e adolescentes, a ANPD entende que não é só o
  consentimento dos pais: outras bases da LGPD servem, **sempre com o melhor interesse do menor** (Enunciado CD/ANPD nº 1/2023).
  O Enunciado é interpretativo e foi criticado pela OAB-SP. **[a confirmar com advogado]**
- **ECA Digital (Lei 15.211/2025)**, em vigor desde março de 2026: vale para serviços digitais com "acesso provável" por menores.
  O Handback **não tem login de aluno** (só professor), então provavelmente fica fora, mas não há decisão da ANPD aplicando isso a
  ferramentas de professor. **[a confirmar com advogado]**
- **Decisão adotada:** começar por ensino superior, pós e corporativo (alunos adultos). Escolas de educação básica só depois do
  parecer jurídico e do contrato de operador. **[a decidir]**

## 4. Subprocessadores e transferência internacional

| Empresa | Serviço | Dados | Observação |
| --- | --- | --- | --- |
| Google (Gemini API) | IA | Texto e arquivos da entrega, já com nome trocado por código e dados escondidos (seção 5) | Conta **paga**: o Google diz que não usa os dados para melhorar produtos, mas guarda pedidos por período limitado só para detectar abuso (hoje 55 dias, segundo a documentação). Retenção zero exige Vertex AI. **[a confirmar a conta paga]** |
| Google (Gmail, Drive, Agenda, Classroom) | Integrações que o professor liga | O mínimo de cada serviço | Só envia e-mail; **não lê** a caixa **[código]** |
| Supabase | Banco, arquivos e login | Todos os dados | **Projeto atual nos Estados Unidos.** Região no Brasil é possível e mais fácil trocar antes de ter usuários reais **[a decidir]** |
| Vercel | Hospedagem do site | Tráfego e logs | **[a confirmar a região]** |
| Resend | E-mails do sistema (convites, avisos) | E-mail do destinatário | **[a confirmar]** |

Transferência internacional (LGPD art. 33): precisa de base (cláusulas-padrão ou equivalente) para os provedores acima.
**[a decidir com advogado]**

## 5. Medidas de proteção

**[código]**
- Cada professor só enxerga a própria instituição (regras de acesso no banco, testadas).
- Verificação em duas etapas obrigatória por padrão; senha conferida contra vazamentos.
- Registro de atividades (quem abriu entrega, baixou arquivo ou relatório, mudou papel).
- Coordenador e banca veem **só números e conceitos aprovados**, nunca devolutiva, arquivo, análise da IA nem e-mail (a trava é do banco).
- **Antes de ir para a IA:** o nome do aluno ou da equipe vira um código; e-mail, telefone, CPF e os nomes do cadastro são escondidos
  no texto (ligado por padrão, a conta pode mudar). **PDF e imagem vão inteiros** (não dá para apagar de dentro deles).
- Alerta "Dado pessoal no trabalho" quando há telefone ou CPF em arquivos.
- Arquivos em área privada com links que expiram. Sem anúncios, sem rastreamento: só cookies de sessão e preferências.

## 6. Inteligência artificial e supervisão humana

**Finalidade:** apoiar o professor a conferir o checklist, rascunhar a devolutiva e sugerir um conceito. **Não decide nota.**

**O que o parecer CNE/CP nº 15/2026 pede** (segundo notícias e resumos; o texto oficial ainda não foi lido por nós **[a confirmar]**):
decisões de avaliação ficam com pessoas; a pré-correção automatizada de textos autorais é de alto risco e exige avaliação de impacto,
supervisão humana documentada, rastreabilidade, auditoria e possibilidade de contestação; detector de IA sozinho não justifica punição.

| Risco | Como o Handback trata |
| --- | --- |
| A IA erra ou é injusta | Nada sai sem aprovação. O conceito sugerido é rascunho; por padrão o professor **precisa escolher** o conceito. Painel "Como a IA está indo" compara IA e professor. |
| O professor só "carimba" | Aprovar exige escolher o conceito (padrão). Opção "Sem sugestão de conceito". Opção de exigir o motivo quando muda. |
| Manipular a IA com texto no trabalho | Alerta automático; só avisa, não muda nada. |
| Viés | **[a decidir]** teste periódico por amostra (versão futura). A IA não recebe o nome do aluno (código). |
| Alerta usado como punição | Toda tela de alerta diz que alerta não é prova nem base para punição. |
| Contestação do aluno | **Registro de supervisão** (sugestão, decisão, motivo, quem aprovou, quando), exportável. |
| Decisão exclusivamente automatizada (LGPD art. 20) | Não existe: sempre há aprovação humana por entrega. |

## 7. Direitos dos titulares (alunos)

Acesso, correção, anonimização/eliminação, informação sobre compartilhamento: quem atende ao titular é a **controladora**;
o Handback fornece as ferramentas (apagar aluno ou equipe, exportar relatório e registro). **[a confirmar]** que apagar remove
entregas, arquivos e análises ligados, e em quanto tempo. **[a decidir]** prazo de retenção (proposta: enquanto a conta existir; apagar
tudo em até 30 dias do encerramento).

## 8. Incidentes

Plano mínimo: avisar a controladora sem demora, com o que foi afetado, e apoiar a comunicação à ANPD e aos titulares. **[a decidir]**
responsável, prazo e modelo de aviso.

## 9. Pendências antes de cobrar ou vender para escolas

1. Revisão por advogado de LGPD e educação (este documento, termos, política, contrato de operador).
2. Confirmar a conta paga do Gemini e decidir sobre Vertex AI (retenção zero, contrato).
3. Decidir a região do Supabase e a base da transferência internacional.
4. Ler o texto oficial do Parecer CNE/CP nº 15/2026 e as diretrizes da USP/IEA.
5. Definir retenção, exclusão e plano de incidentes.
6. Verificação em duas etapas nas contas de administração.

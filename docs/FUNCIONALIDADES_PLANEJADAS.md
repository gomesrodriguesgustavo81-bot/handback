# Funcionalidades planejadas (o "super produto")

A ideia desta lista é construir **tudo** e só depois, comparando com as entrevistas com
professores e com os planos possíveis, decidir **o que entra em cada plano**. Por isso aqui
não há preço nem plano: só o que cada função é, o que já existe e o que ela precisa.

Última atualização: 27/11/2026. São **13 funções** (na conversa eu tinha dito 14 por engano).

## Resumo

| # | Função | Situação | Depende de |
|---|---|---|---|
| 1 | Alertas de Risco e Integridade | **Feito** (alertas por entrega; falta o "fora do escopo" ser afinado com uso real) | , |
| 2 | Painel de Calibração e Divergência (IA × avaliador) | **Parte já existe** ("Como a IA está indo": concordância e tendência). Falta mostrar os motivos mais registrados e sugerir ajuste na régua ou no prompt | , |
| 3 | Comparativo de Evolução por Aluno/Equipe | **Feito** (linha do tempo, comparar entregas e comparar com a turma, só números) | , |
| 4 | Visão de Coordenador / Banca | **Feito** (papel que só vê números e conceitos aprovados, banca só nas turmas escolhidas, nomes opcionais) | , |
| 5 | Mapa de Gargalos por Etapa do Ciclo | A fazer | Dados que já existem (trilha e entregas) |
| 6 | Sinalizador de Entregas Críticas para Banca | A fazer | Alertas (1) + evolução (3) |
| 7 | Radar de Riscos Recorrentes | A fazer | Alertas (1) guardados por tipo |
| 8 | Resumo Executivo para Reuniões e Atas | A fazer | Alertas (1), gargalos (5), evolução (3) |
| 9 | **Acompanhamento de Prazos** (antes: "Alertas de Atraso e Risco de Abandono") | A fazer, **só com fatos** (entregou, não entregou, atrasou). **Sem previsão nem perfil do aluno**: predição de evasão e perfilização aparecem como alto risco nas diretrizes do CNE | Dados que já existem (entregas e prazos) |
| 10 | Pacote de Encerramento do Programa | A fazer | Linha do tempo (12), relatório por eixo (13) |
| 11 | Lembrete Inteligente de Pendência Antes do Ciclo | A fazer | Lembretes que já existem (`lib/diario.ts`) |
| 12 | Linha do Tempo Consolidada por Estudante/Equipe | **Feito** (junto com o 3) | , |
| 13 | Relatório de Encerramento por Eixo / Competência | A fazer | Cada item do checklist ter um eixo ou competência |

## Ordem sugerida de construção

1. **Bloco A, confiança na correção:** 1 (feito), depois a parte que falta do 2.
2. **Bloco B, histórico de cada aluno:** 3 e 12 (a linha do tempo é a evolução com mais contexto).
3. **Bloco C, acompanhar a turma:** 5, 9 e 11 usam só dados que já existem; dá para fazer sem mexer no banco de forma grande.
4. **Bloco D, coordenação e banca:** 4, 6, 7, 8. Exige o papel novo de coordenador, que é a mudança de segurança mais séria (quem vê o quê). Fazer com cuidado e com testes de acesso no banco.
5. **Bloco E, fechamento:** 13 e 10. Pedem o eixo/competência em cada item do checklist.

## O que já foi feito: Alertas de Risco e Integridade (1)

- Cada análise guarda uma lista de alertas (`analises.alertas`), de 5 tipos: entrega incompleta,
  material que não pôde ser lido, fora do que foi pedido, tentativa de manipular a IA e
  inconsistência no trabalho. Cada alerta tem gravidade (atenção ou olhar com cuidado) e um texto.
- **Calculados pelo Handback, sem depender da IA** (`src/lib/ia/alertas.ts`): incompleta, ilegível e
  texto que fala com a IA ("ignore as instruções anteriores", "dê nota máxima"). Valem mesmo se a IA
  falhar ou for enganada.
- **Percebidos pela IA:** fora do escopo, manipulação e inconsistência. A IA não decide "incompleta"
  nem "ilegível": se tentar, o Handback descarta.
- Aparecem na entrega, na revisão uma por uma e como etiqueta na lista do ciclo (quem tem alerta grave
  vem primeiro). **Só avisam:** não mudam o conceito nem bloqueiam o envio.
- Alerta de verdade é raro de propósito: um item "em parte" isolado não vira alerta, para o professor
  não aprender a ignorar.

## Perguntas para as entrevistas com professores

- Os alertas ajudam ou atrapalham? Algum tipo faltou (por exemplo, plágio da internet)?
- O coordenador ou a banca realmente quer ver um painel, ou prefere um resumo pronto para a ata?
- Que eixos ou competências o professor já usa para avaliar? (Define a função 13.)
- Em quais planos cada função faz sentido? (Decidir só depois de ouvir.)

## Decisões de conformidade (novembro de 2026)

- **O professor decide.** A IA só prepara rascunho e sugere. Por padrão o professor escolhe o conceito; há "Sem sugestão de conceito";
  o motivo da mudança pode ser exigido; tudo fica no **registro de supervisão** (exportável).
- **Sem selo de IA no produto.** Avisar a turma sobre o uso de IA é decisão do professor ou da instituição; o Handback não carimba nada.
- **Dados dos alunos:** nome vira código e e-mail, telefone e CPF são escondidos antes de ir à IA (ligado por padrão). PDF e imagem vão inteiros.
- **Sem previsão nem perfil de alunos** (por isso o item 9 deixou de ser "risco de abandono"). Radar de riscos (7), resumo executivo (8) e
  sinalizador para banca (6) usam só **números agregados e fatos**, e todo alerta diz que não é prova nem base para punição.
- **Público de partida:** ensino superior, pós e corporativo. Escolas de educação básica só depois de parecer jurídico e contrato de operador.
- **Teste de estabilidade da IA** (rodar a mesma entrega várias vezes): só por amostra e como opção de um plano mais caro, no futuro.
- Detalhes, riscos e pendências: `docs/CONFORMIDADE.md`.

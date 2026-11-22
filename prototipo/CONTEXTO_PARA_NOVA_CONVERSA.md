# Contexto para continuar este projeto numa nova conversa

Cole este texto no início de uma nova conversa com o Claude e anexe o arquivo .zip.

## O projeto
App em Google Apps Script com Google Sheets como base de dados, Gemini como IA, e Gmail, Drive e Agenda
integrados. Serve para avaliar continuamente as entregas de 6 equipes de consultoria (design, saúde e tecnologia).
- Conceitos EXCELENTE, BOM, REGULAR e RUIM (e PENDENTE). Nunca há notas numéricas.
- O assistente (dono) e os professores (por link pessoal) revisam e aprovam. Os e-mails saem da conta do assistente.
- O app web é publicado como "Executar como: eu" e "Quem pode acessar: qualquer pessoa com Conta do Google".
- A pasta contém a versão atual de todos os arquivos, de 01_Base a 13_Automacao, mais o App.html.
- O RESUMO_DO_APP.md explica o fluxo, as telas e as regras.

## Forma de trabalho combinada
- Fazemos passo a passo. Cada passo traz arquivos `_COPIAR.txt` (para colar no Apps Script) e um `LEIA_NAO_COLAR_*.txt`.
- Funções novas se registram em `API_EXTRA` e são chamadas pelo `apiRun` do `07_Aprovacao`, que não precisa mudar.
- Depois de cada mudança: Implantar › Gerenciar implantações › Nova versão.
- Permissões novas (Drive, Agenda, gatilhos): rodar `autorizarAgenda` / `autorizarAutomacao` no editor.
- Testes feitos com simulações (Node vm) e capturas de tela de celular (Playwright, Pixel 7).
- Não mandar à IA documentos pessoais (bolsistas): eles devem ser "Ignorados".
- A chave do Gemini fica só nas Propriedades do Script.

## Situação atual
- Instalados e confirmados pelo usuário: passos 1 a 9.
- Entregues, aguardando teste real: passo 10 (Drive), passos 11 a 11.2 (Agenda e calendário) e passo 12 (modo automático,
  cobrança, cópias de segurança, fechamento do curso).
- Modelo de IA em uso: `gemini-flash-lite-latest` (cota do gratuito).

## Pendências
1. **Calibrar o conceito da IA.** O usuário disse "nenhum dos 3 bateu". A hipótese é que a regra
   "item PARCIAL → no máximo BOM" é rígida demais, porque os professores deram EXCELENTE a Google/FAU e Fleury.
   Opções: tirar esse limite ou deixar REGRA_CHECKLIST = NÃO. Falta o usuário dizer quais 3 equipes e os conceitos dados.
2. Opcional: frequência do modo automático configurável (hoje é de hora em hora; a cada 4h já basta).
3. Opcional: análise de 2 entregas em paralelo; professores poderem tocar em "Enviar" (sai da conta do assistente).

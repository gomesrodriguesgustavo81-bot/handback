# Avaliação Contínua de Entregas: resumo do app

App em **Google Apps Script** para acompanhar as entregas de 6 equipes de consultoria
(design, saúde e tecnologia). As equipes mandam cada entrega por e-mail, a IA (Gemini)
confere e sugere uma devolutiva, os professores revisam e aprovam, e a devolutiva sai
por e-mail. Não há notas numéricas: só conceitos (**EXCELENTE, BOM, REGULAR, RUIM**) e a
evolução de cada equipe ao longo das aulas.

- **Onde roda:** num link de app web (Apps Script) que abre no celular e no computador.
- **Onde ficam os dados:** numa planilha Google, que é o "motor". O dia a dia é feito no app.
- **Quem usa:** o assistente, que é o dono, e os professores, cada um com um link pessoal.
- **De onde saem os e-mails:** sempre da conta do assistente.

---

## 1. O fluxo de uma aula

1. **Planejar.** Na aba Aulas, você define o título, as datas, o que deve ser entregue (checklist) e as métricas de qualidade.
2. **Equipes enviam.** O e-mail vai para o assistente com o assunto `[ENTREGA] Aula N - Nome da Equipe`.
3. **📥 Buscar entregas.** O app lê o Gmail e faz três coisas:
   - registra as entregas e marca as que chegaram com atraso;
   - ignora o que não é entrega (documentos pessoais, cadastro, pagamento etc.);
   - quando o assunto está fora do padrão, manda o e-mail para **"Para confirmar"**.
4. **🤖 Analisar.** A IA lê o e-mail, os anexos e os links, e devolve:
   - o checklist item por item (✅ entregue · 🟡 parcial · ❌ não entregue);
   - um conceito sugerido, com justificativa;
   - uma análise interna, só para o professor;
   - um rascunho de feedback para a equipe, no estilo dos feedbacks já aprovados.
5. **Revisar e aprovar.** O professor edita o texto se quiser, ajusta o conceito e aprova.
6. **📨 Enviar.** A devolutiva sai em HTML, como resposta na mesma conversa do e-mail da equipe, com os professores em cópia.
7. **📊 Relatório da aula.** Mostra um resumo da turma, os destaques, as equipes que precisam de atenção e sugestões para a próxima aula.

---

## 2. Telas do app

| Aba | Para que serve |
|---|---|
| **▦ Painel** | Escolher a aula e ver os números dela, buscar, analisar, cuidar do "Para confirmar", ver cada equipe (histórico e devolutiva), aprovar e enviar |
| **☰ Aulas** | Criar, editar e excluir aulas, e gerar as instruções para as equipes |
| **👥 Equipes** | Cadastrar equipes e e-mails, ver o histórico e abrir a pasta da equipe no Drive |
| **📅 Agenda** | Calendário do mês com aulas, prazos, devolutivas e outros compromissos. Dá para pôr e tirar dias, e mostra quem entregou em cada aula |
| **⚙️ Ajustes** | Só o assistente: professores (links), configurações, Drive e verificação da instalação |

O ⟳ no topo atualiza tudo. O app também se atualiza sozinho a cada 60 segundos.

---

## 3. Regras importantes

- **Conceito pelo checklist** (pode ser desligado em Config › REGRA_CHECKLIST):
  - tudo ✅: a IA decide pela qualidade;
  - algum 🟡 e nenhum ❌: no máximo BOM;
  - algum ❌, até metade dos itens: REGULAR;
  - mais da metade ❌: RUIM;
  - uma observação do professor na aula que cite um conceito tem prioridade.
- **Nada sai sem aprovação humana.**
- **Reenvio:** quando a equipe manda de novo, a entrega antiga fica como "Substituída".
- **Cancelar a análise** para na hora e não gasta mais chamadas da IA.
- **Privacidade:**
  - a chave do Gemini fica só nas Propriedades do Script;
  - documentos pessoais devem ser marcados como "Ignorar" e nunca vão para a IA;
  - os alunos não veem os e-mails uns dos outros na agenda.

---

## 4. Arquivos do projeto (Apps Script)

| Arquivo | Função |
|---|---|
| `01_Base` | Estrutura da planilha (abas Aulas, Equipes, Entregas, Relatórios, Ações, Config), menu e leitura de dados |
| `02_App` | Abre o app web, identifica quem está usando e carrega os dados iniciais |
| `03_Gmail` | Busca e classifica e-mails: entrega, "Para confirmar" ou ignorar |
| `04_IA` | Análise com o Gemini, regra do checklist e modelos de reserva quando a cota acaba |
| `04b_Diagnostico` | Testa a chave e os modelos do Gemini |
| `05_Correcoes` | Corrigir a aula ou a equipe de uma entrega, excluir e restaurar |
| `06_RaioX` | Mostra tudo o que a busca encontrou e permite importar à mão |
| `07_Aprovacao` | Links dos professores, editar, aprovar e avisar. Também é a porta de entrada de todas as funções do app |
| `08_Envio` | Monta e envia as devolutivas e o e-mail de teste |
| `09_Relatorio` | Relatório da aula com IA |
| `10_Gestao` | Aulas, equipes, configurações e professores pelo app |
| `11_Drive` | Pasta `Entregas — Consultoria / Equipe / Aula` com os anexos e os links |
| `12_Calendario` | Google Agenda: convites de aulas e prazos, lembretes internos de devolutiva, compromissos avulsos |
| `App.html` | A interface do app (celular e computador) |

**Na planilha:**
- **Entregas** guarda o histórico completo.
- **Ações** registra quem fez o quê e quando.
- **Config** guarda os ajustes, que dá para editar sem mexer no código.

---

## 5. Integrações

- **Gmail:** lê as entregas e envia as devolutivas pela conta do assistente.
- **Gemini:** faz a análise. O modelo atual é `gemini-flash-lite-latest`, e há modelos de reserva automáticos.
- **Google Drive:** guarda os arquivos de cada equipe e aula. A pasta pode ser compartilhada com os professores, só para leitura.
- **Google Agenda:** a agenda "Consultoria — Aulas e Entregas" convida professores e alunos e se atualiza quando uma data muda.

---

## 6. Manutenção rápida

- **Depois de mudar o código:** Implantar › Gerenciar implantações › ✏️ › **Nova versão**.
- **Erro de permissão** (Drive, Agenda): rode a função de autorização no editor e aceite.
- **Cota do Gemini esgotada:** troque Config › MODELO_IA ou espere a cota renovar.
- **Para conferir tudo:** Ajustes › 🩺 Verificar instalação.

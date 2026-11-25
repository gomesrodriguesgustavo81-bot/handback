/** Textos da página de entrada (vitrine) em português, inglês e espanhol. */

export type Idioma = "pt" | "en" | "es";

export const IDIOMAS: { id: Idioma; sigla: string; nome: string; caminho: string; html: string }[] = [
  { id: "pt", sigla: "PT", nome: "Português", caminho: "/", html: "pt-BR" },
  { id: "en", sigla: "EN", nome: "English", caminho: "/en", html: "en" },
  { id: "es", sigla: "ES", nome: "Español", caminho: "/es", html: "es" },
];

type Item = { titulo: string; texto: string };

export type TextosVendas = {
  meta: { titulo: string; descricao: string };
  menu: { como: string; controle: string; seguranca: string; perguntas: string; entrar: string; criar: string };
  hero: { selo: string; titulo1: string; titulo2: string; texto: string; testar: string; verComo: string; funcionaCom: string; integracoes: string };
  previa: {
    ciclo: string;
    turma: string;
    passos: [string, string, string, string, string];
    aluno: string;
    conceito: string;
    itens: { item: string; status: "ok" | "parcial" | "falta" }[];
    devolutiva: string;
    ia: string;
    aprovar: string;
  };
  como: { titulo: string; passos: Item[] };
  controle: { titulo: string; itens: Item[] };
  seguranca: { titulo: string; texto: string; itens: string[]; politica: string };
  perguntas: { titulo: string; itens: { p: string; r: string }[] };
  final: { titulo: string; texto: string; botao: string };
  rodape: { privacidade: string; termos: string; contato: string; aviso: string };
  assuntoEmail: string;
};

export const TEXTOS: Record<Idioma, TextosVendas> = {
  pt: {
    meta: {
      titulo: "Handback · Entregas conferidas com IA, aprovadas por você",
      descricao:
        "As entregas chegam pelo Google Classroom, Moodle ou e-mail. A IA confere o checklist e escreve a devolutiva. Você revisa, aprova e ela volta para o aluno.",
    },
    menu: { como: "Como funciona", controle: "Você no controle", seguranca: "Segurança", perguntas: "Perguntas", entrar: "Entrar", criar: "Criar conta grátis" },
    hero: {
      selo: "Para professores, coordenadores e escolas",
      titulo1: "Você recebe,",
      titulo2: "a gente devolve conferido.",
      texto:
        "As entregas chegam sozinhas pelo Google Classroom, Moodle ou e-mail. A IA confere o checklist que você pediu e escreve a devolutiva. Você revisa, aprova, e ela volta para o aluno. Nada sai sem você.",
      testar: "Criar minha conta grátis",
      verComo: "Ver como funciona",
      funcionaCom: "Funciona com:",
      integracoes: "Google Classroom · Moodle · E-mail · Google Drive · Google Agenda",
    },
    previa: {
      ciclo: "Ciclo 3 · Derivadas",
      turma: "Cálculo I",
      passos: ["Tarefa", "Receber", "Analisar", "Revisar", "Enviar"],
      aluno: "Ana Souza",
      conceito: "BOM",
      itens: [
        { item: "Exercícios 1 a 5 resolvidos", status: "ok" },
        { item: "Regra da cadeia explicada", status: "ok" },
        { item: "Gráfico da função (parcial)", status: "parcial" },
      ],
      devolutiva: "Ana, muito bom o uso da regra da cadeia nos exercícios 3 e 4. No gráfico, faltou marcar os pontos críticos…",
      ia: "Sugerido pela IA · você aprova",
      aprovar: "Aprovar e próxima",
    },
    como: {
      titulo: "Cada ciclo em 5 passos. Você sempre sabe o próximo.",
      passos: [
        { titulo: "Tarefa pronta", texto: "Você escreve o checklist do que o aluno entrega. Pode publicar a tarefa no Classroom." },
        { titulo: "Receber", texto: "As entregas chegam sozinhas. Quem ainda não entregou recebe um lembrete." },
        { titulo: "Analisar", texto: "A IA lê arquivos, PDFs, fotos e links e confere item por item o que foi pedido." },
        { titulo: "Revisar", texto: "Uma entrega por vez: ajuste o conceito e o texto, aprove e vá para a próxima." },
        { titulo: "Enviar", texto: "Um botão: a nota vai para o Classroom ou o Moodle e a devolutiva vai por e-mail." },
      ],
    },
    controle: {
      titulo: "Você no controle, do começo ao fim",
      itens: [
        { titulo: "Nada sai sem a sua aprovação", texto: "A IA sugere o conceito e a devolutiva. Quem decide é você, e ela aprende com as suas correções." },
        { titulo: "Piloto automático", texto: "Ligue numa turma e o que chega já é analisado. Você recebe um aviso quando estiver pronto para revisar." },
        { titulo: "Acompanhe a turma", texto: "Quem melhorou, quem caiu e quem precisa de atenção ao longo dos ciclos, com relatório em PDF." },
      ],
    },
    seguranca: {
      titulo: "Seguro e de acordo com a LGPD",
      texto: "Os dados dos seus alunos ficam protegidos, e só você e quem você autorizar enxergam.",
      itens: [
        "Cada professor conecta a própria conta, só com o necessário",
        "Documentos pessoais (RG, CPF) nunca vão para a IA",
        "Verificação em duas etapas e registro de quem fez o quê",
        "A IA usada não treina com os trabalhos dos seus alunos",
        "Seu Gmail só envia: o Handback pede ao Google só a permissão de enviar e-mails e nunca lê a sua caixa",
        "Arquivos em área privada, com links que expiram",
      ],
      politica: "Leia a política de privacidade",
    },
    perguntas: {
      titulo: "Perguntas",
      itens: [
        { p: "A IA corrige sozinha?", r: "Não. A IA sugere o conceito e escreve um rascunho. Você revisa e aprova cada devolutiva antes de ela sair." },
        { p: "O aluno precisa criar conta?", r: "Não. Ele entrega como já faz hoje: no Google Classroom, no Moodle ou mandando um e-mail para o endereço da turma." },
        { p: "Funciona com a minha escola?", r: "Funciona com o Google Classroom, com o Moodle da sua instituição e com e-mail. Cada professor conecta a própria conta." },
        { p: "Quanto custa?", r: "Por enquanto é grátis para os primeiros professores, sem cartão de crédito. Os planos vão ser anunciados antes de qualquer cobrança." },
        { p: "A IA aprende com os trabalhos dos alunos?", r: "Não. Usamos a IA paga do Google, que não treina com o conteúdo enviado. O Handback aprende o seu critério só dentro da sua conta." },
        { p: "Funciona no celular?", r: "Sim. O Handback foi pensado primeiro para o celular, e dá para receber avisos nele." },
      ],
    },
    final: { titulo: "Corrija a próxima turma com o Handback", texto: "Crie sua conta em 1 minuto. Sem cartão de crédito.", botao: "Criar minha conta grátis" },
    rodape: { privacidade: "Política de privacidade", termos: "Termos de uso", contato: "Contato", aviso: "" },
    assuntoEmail: "Quero testar o Handback",
  },
  en: {
    meta: {
      titulo: "Handback · Submissions checked by AI, approved by you",
      descricao:
        "Submissions arrive from Google Classroom, Moodle or email. AI checks the checklist and drafts the feedback. You review, approve, and it goes back to the student.",
    },
    menu: { como: "How it works", controle: "You're in control", seguranca: "Security", perguntas: "FAQ", entrar: "Sign in", criar: "Request a trial" },
    hero: {
      selo: "For teachers, coordinators and schools",
      titulo1: "You receive it,",
      titulo2: "we hand it back checked.",
      texto:
        "Submissions arrive on their own from Google Classroom, Moodle or email. AI checks the checklist you asked for and drafts the feedback. You review, approve, and it goes back to the student. Nothing is sent without you.",
      testar: "Request a trial",
      verComo: "See how it works",
      funcionaCom: "Works with:",
      integracoes: "Google Classroom · Moodle · Email · Google Drive · Google Calendar",
    },
    previa: {
      ciclo: "Cycle 3 · Derivatives",
      turma: "Calculus I",
      passos: ["Task", "Receive", "Analyze", "Review", "Send"],
      aluno: "Ana Souza",
      conceito: "GOOD",
      itens: [
        { item: "Exercises 1 to 5 solved", status: "ok" },
        { item: "Chain rule explained", status: "ok" },
        { item: "Function graph (partial)", status: "parcial" },
      ],
      devolutiva: "Ana, great use of the chain rule in exercises 3 and 4. In the graph, the critical points are missing…",
      ia: "Suggested by AI · you approve",
      aprovar: "Approve and next",
    },
    como: {
      titulo: "Every cycle in 5 steps. You always know what's next.",
      passos: [
        { titulo: "Task ready", texto: "You write the checklist of what students hand in. You can publish the task to Classroom." },
        { titulo: "Receive", texto: "Submissions arrive on their own. Whoever hasn't submitted gets a reminder." },
        { titulo: "Analyze", texto: "AI reads files, PDFs, photos and links and checks each requested item." },
        { titulo: "Review", texto: "One at a time: adjust the grade and the text, approve and move on." },
        { titulo: "Send", texto: "One button: the grade goes to Classroom or Moodle and the feedback goes by email." },
      ],
    },
    controle: {
      titulo: "You're in control, start to finish",
      itens: [
        { titulo: "Nothing goes out without you", texto: "AI suggests the grade and the feedback. You decide, and it learns from your corrections." },
        { titulo: "Autopilot", texto: "Turn it on for a class and new submissions are analyzed right away. You get a notice when they're ready." },
        { titulo: "Follow the class", texto: "Who improved, who dropped and who needs attention across cycles, with a PDF report." },
      ],
    },
    seguranca: {
      titulo: "Secure and privacy-first",
      texto: "Your students' data stays protected, visible only to you and the people you authorize.",
      itens: [
        "Each teacher connects their own account, with only what's needed",
        "Personal documents (IDs) never go to the AI",
        "Two-step verification and a log of who did what",
        "The AI we use doesn't train on your students' work",
        "Your Gmail only sends: Handback asks Google only for permission to send emails and never reads your inbox",
        "Files in a private area, with expiring links",
      ],
      politica: "Read the privacy policy",
    },
    perguntas: {
      titulo: "FAQ",
      itens: [
        { p: "Does the AI grade on its own?", r: "No. AI suggests a grade and drafts the feedback. You review and approve each one before it goes out." },
        { p: "Do students need an account?", r: "No. They submit as they already do: in Google Classroom, in Moodle or by emailing the class address." },
        { p: "Does it work with my school?", r: "It works with Google Classroom, your institution's Moodle and email. Each teacher connects their own account." },
        { p: "How much does it cost?", r: "Early teachers use it for free, no credit card. Plans will be announced before any charge." },
        { p: "Does the AI learn from students' work?", r: "No. We use Google's paid AI, which doesn't train on submitted content. Handback learns your criteria only inside your account." },
        { p: "Does it work on my phone?", r: "Yes. Handback was designed mobile-first, with notifications." },
      ],
    },
    final: { titulo: "Grade your next class with Handback", texto: "Tell us how you work. We'll set everything up for your first cycle.", botao: "Request a trial" },
    rodape: { privacidade: "Privacy policy", termos: "Terms of use", contato: "Contact", aviso: "The app is currently in Portuguese; English is coming soon." },
    assuntoEmail: "Handback trial request",
  },
  es: {
    meta: {
      titulo: "Handback · Entregas revisadas con IA, aprobadas por ti",
      descricao:
        "Las entregas llegan desde Google Classroom, Moodle o correo. La IA revisa la lista y redacta la retroalimentación. Tú revisas, apruebas y vuelve al estudiante.",
    },
    menu: { como: "Cómo funciona", controle: "Tú decides", seguranca: "Seguridad", perguntas: "Preguntas", entrar: "Entrar", criar: "Quiero probar" },
    hero: {
      selo: "Para profesores, coordinadores y escuelas",
      titulo1: "Tú recibes,",
      titulo2: "nosotros devolvemos revisado.",
      texto:
        "Las entregas llegan solas desde Google Classroom, Moodle o correo. La IA revisa la lista que pediste y redacta la retroalimentación. Tú revisas, apruebas y vuelve al estudiante. Nada sale sin ti.",
      testar: "Quiero probar",
      verComo: "Ver cómo funciona",
      funcionaCom: "Funciona con:",
      integracoes: "Google Classroom · Moodle · Correo · Google Drive · Google Calendar",
    },
    previa: {
      ciclo: "Ciclo 3 · Derivadas",
      turma: "Cálculo I",
      passos: ["Tarea", "Recibir", "Analizar", "Revisar", "Enviar"],
      aluno: "Ana Souza",
      conceito: "BUENO",
      itens: [
        { item: "Ejercicios 1 a 5 resueltos", status: "ok" },
        { item: "Regla de la cadena explicada", status: "ok" },
        { item: "Gráfico de la función (parcial)", status: "parcial" },
      ],
      devolutiva: "Ana, muy buen uso de la regla de la cadena en los ejercicios 3 y 4. En el gráfico faltaron los puntos críticos…",
      ia: "Sugerido por la IA · tú apruebas",
      aprovar: "Aprobar y siguiente",
    },
    como: {
      titulo: "Cada ciclo en 5 pasos. Siempre sabes el siguiente.",
      passos: [
        { titulo: "Tarea lista", texto: "Escribes la lista de lo que el estudiante entrega. Puedes publicar la tarea en Classroom." },
        { titulo: "Recibir", texto: "Las entregas llegan solas. Quien aún no entregó recibe un recordatorio." },
        { titulo: "Analizar", texto: "La IA lee archivos, PDF, fotos y enlaces y revisa cada punto pedido." },
        { titulo: "Revisar", texto: "Una a la vez: ajusta la nota y el texto, aprueba y pasa a la siguiente." },
        { titulo: "Enviar", texto: "Un botón: la nota va a Classroom o Moodle y la retroalimentación va por correo." },
      ],
    },
    controle: {
      titulo: "Tú decides, de principio a fin",
      itens: [
        { titulo: "Nada sale sin tu aprobación", texto: "La IA sugiere la nota y la retroalimentación. Tú decides, y aprende con tus correcciones." },
        { titulo: "Piloto automático", texto: "Actívalo en un grupo y lo que llega se analiza al instante. Recibes un aviso cuando está listo." },
        { titulo: "Sigue al grupo", texto: "Quién mejoró, quién bajó y quién necesita atención a lo largo de los ciclos, con informe en PDF." },
      ],
    },
    seguranca: {
      titulo: "Seguro y privado",
      texto: "Los datos de tus estudiantes quedan protegidos y solo tú y quien autorices los ven.",
      itens: [
        "Cada profesor conecta su propia cuenta, solo con lo necesario",
        "Los documentos personales nunca van a la IA",
        "Verificación en dos pasos y registro de quién hizo qué",
        "La IA que usamos no entrena con los trabajos de tus estudiantes",
        "Tu Gmail solo envía: Handback pide a Google solo el permiso de enviar correos y nunca lee tu bandeja",
        "Archivos en un área privada, con enlaces que expiran",
      ],
      politica: "Lee la política de privacidad",
    },
    perguntas: {
      titulo: "Preguntas",
      itens: [
        { p: "¿La IA corrige sola?", r: "No. La IA sugiere la nota y redacta un borrador. Tú revisas y apruebas cada retroalimentación antes de enviarla." },
        { p: "¿El estudiante necesita una cuenta?", r: "No. Entrega como ya lo hace: en Google Classroom, en Moodle o enviando un correo a la dirección del grupo." },
        { p: "¿Funciona con mi escuela?", r: "Funciona con Google Classroom, con el Moodle de tu institución y con correo. Cada profesor conecta su propia cuenta." },
        { p: "¿Cuánto cuesta?", r: "Por ahora es gratis para los primeros profesores, sin tarjeta. Los planes se anunciarán antes de cualquier cobro." },
        { p: "¿La IA aprende de los trabajos?", r: "No. Usamos la IA de pago de Google, que no entrena con el contenido enviado. Handback aprende tu criterio solo dentro de tu cuenta." },
        { p: "¿Funciona en el celular?", r: "Sí. Handback fue pensado primero para el celular, con avisos." },
      ],
    },
    final: { titulo: "Corrige tu próximo grupo con Handback", texto: "Cuéntanos cómo trabajas. Preparamos todo para tu primer ciclo.", botao: "Quiero probar" },
    rodape: { privacidade: "Política de privacidad", termos: "Términos de uso", contato: "Contacto", aviso: "La aplicación está en portugués por ahora; el español llegará pronto." },
    assuntoEmail: "Quiero probar Handback",
  },
};

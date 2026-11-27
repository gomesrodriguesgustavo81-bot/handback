/** Textos da página de entrada (vitrine) em português, inglês e espanhol. */

export type Idioma = "pt" | "en" | "es";

export const IDIOMAS: { id: Idioma; sigla: string; nome: string; caminho: string; html: string }[] = [
  { id: "pt", sigla: "PT", nome: "Português", caminho: "/", html: "pt-BR" },
  { id: "en", sigla: "EN", nome: "English", caminho: "/en", html: "en" },
  { id: "es", sigla: "ES", nome: "Español", caminho: "/es", html: "es" },
];

type Item = { titulo: string; texto: string };
type Bloco = { titulo: string; itens: string[] };

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
  transparencia: { selo: string; titulo: string; pedimos: Bloco; fazemos: Bloco; naoFazemos: Bloco };
  final: { titulo: string; texto: string; botao: string };
  rodape: { privacidade: string; termos: string; cookies: string; contato: string; aviso: string };
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
      titulo1: "Você recebe, a IA prepara o rascunho,",
      titulo2: "você decide.",
      texto:
        "As entregas chegam sozinhas pelo Google Classroom, Moodle ou e-mail. A IA confere o checklist que você pediu e escreve um rascunho da devolutiva. Você escolhe o conceito, revisa e assina. Nada sai sem você.",
      testar: "Criar minha conta grátis",
      verComo: "Ver como funciona",
      funcionaCom: "Funciona com:",
      integracoes: "Google Classroom · Moodle · E-mail · Google Drive · Google Agenda",
    },
    previa: {
      ciclo: "Entrega 3 · Derivadas",
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
      ia: "Rascunho da IA · o conceito é seu",
      aprovar: "Aprovar e próxima",
    },
    como: {
      titulo: "Cada entrega em 5 passos. Você sempre sabe o próximo.",
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
        { titulo: "Nada sai sem a sua aprovação", texto: "A IA só prepara o rascunho. O conceito e a assinatura são seus: dá para desligar a sugestão de conceito e ver tudo no registro de supervisão." },
        { titulo: "Piloto automático", texto: "Ligue numa turma e o que chega já é analisado. Você recebe um aviso quando estiver pronto para revisar." },
        { titulo: "Acompanhe a turma", texto: "Quem melhorou, quem caiu e quem precisa de atenção ao longo das entregas, com relatório em PDF." },
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
        { p: "A IA corrige sozinha?", r: "Não. A IA prepara um rascunho. Você escolhe o conceito, revisa e assina cada devolutiva antes de ela sair." },
        { p: "O aluno precisa criar conta?", r: "Não. Ele entrega como já faz hoje: no Google Classroom, no Moodle ou mandando um e-mail para o endereço da turma." },
        { p: "Funciona com a minha escola?", r: "Funciona com o Google Classroom, com o Moodle da sua instituição e com e-mail. Cada professor conecta a própria conta." },
        { p: "Quanto custa?", r: "Por enquanto é grátis para os primeiros professores, sem cartão de crédito. Os planos vão ser anunciados antes de qualquer cobrança." },
        { p: "A IA aprende com os trabalhos dos alunos?", r: "Não. Usamos a IA paga do Google, que não treina com o conteúdo enviado. O Handback aprende o seu critério só dentro da sua conta." },
        { p: "Funciona no celular?", r: "Sim. O Handback foi pensado primeiro para o celular, e dá para receber avisos nele." },
        { p: "O que acontece com os dados dos alunos?", r: "Ficam na sua conta. Antes de irem para a IA, trocamos o nome por um código e escondemos e-mail, telefone e CPF (você pode desligar). Não usamos os trabalhos para treinar IA nem para outro fim, e você pode pedir a exclusão." },
        { p: "Vocês usam cookies?", r: "Só os necessários: manter você conectado, lembrar a turma escolhida e o tema claro ou escuro. Não usamos cookies de anúncio nem de rastreamento." },
      ],
    },
    transparencia: {
      selo: "Transparência",
      titulo: "O que pedimos, o que fazemos e o que não fazemos",
      pedimos: {
        titulo: "O que pedimos",
        itens: [
          "Seu e-mail e uma senha, para criar a conta.",
          "Permissão para ligar o seu Classroom, Moodle ou e-mail. Você escolhe e pode desligar quando quiser.",
          "O checklist e os critérios de cada tarefa.",
          "Os nomes dos alunos da turma, só para organizar as entregas.",
        ],
      },
      fazemos: {
        titulo: "O que fazemos",
        itens: [
          "Usamos a IA para conferir o checklist e escrever um rascunho.",
          "Trocamos o nome do aluno por um código e escondemos e-mail, telefone e CPF antes de enviar à IA (você pode desligar).",
          "Guardamos o registro do que a IA sugeriu e do que você decidiu.",
          "Guardamos os arquivos em área privada, com links que expiram.",
        ],
      },
      naoFazemos: {
        titulo: "O que não fazemos",
        itens: [
          "Não decidimos conceito nem enviamos devolutiva sem a sua aprovação.",
          "Não usamos os trabalhos dos alunos para treinar IA.",
          "Não vendemos dados nem mostramos anúncios.",
          "Não lemos a sua caixa de e-mail: o Gmail só envia.",
          "Não mandamos documentos pessoais (RG, CPF) para a IA.",
          "Não usamos cookies de propaganda nem de rastreamento.",
        ],
      },
    },
    final: { titulo: "Corrija a próxima turma com o Handback", texto: "Crie sua conta em 1 minuto. Sem cartão de crédito.", botao: "Criar minha conta grátis" },
    rodape: { privacidade: "Política de privacidade", termos: "Termos de uso", cookies: "Cookies", contato: "Contato", aviso: "" },
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
      titulo1: "You receive it, AI drafts,",
      titulo2: "you decide.",
      texto:
        "Submissions arrive on their own from Google Classroom, Moodle or email. AI checks the checklist you asked for and writes a draft of the feedback. You choose the grade, review and sign. Nothing is sent without you.",
      testar: "Request a trial",
      verComo: "See how it works",
      funcionaCom: "Works with:",
      integracoes: "Google Classroom · Moodle · Email · Google Drive · Google Calendar",
    },
    previa: {
      ciclo: "Delivery 3 · Derivatives",
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
      ia: "AI draft · the grade is yours",
      aprovar: "Approve and next",
    },
    como: {
      titulo: "Every delivery in 5 steps. You always know what's next.",
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
        { titulo: "Nothing goes out without you", texto: "AI only prepares the draft. The grade and the signature are yours: you can turn off the grade suggestion and see everything in the supervision record." },
        { titulo: "Autopilot", texto: "Turn it on for a class and new submissions are analyzed right away. You get a notice when they're ready." },
        { titulo: "Follow the class", texto: "Who improved, who dropped and who needs attention across deliveries, with a PDF report." },
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
        { p: "Does the AI grade on its own?", r: "No. AI prepares a draft. You choose the grade, review and sign each one before it goes out." },
        { p: "Do students need an account?", r: "No. They submit as they already do: in Google Classroom, in Moodle or by emailing the class address." },
        { p: "Does it work with my school?", r: "It works with Google Classroom, your institution's Moodle and email. Each teacher connects their own account." },
        { p: "How much does it cost?", r: "Early teachers use it for free, no credit card. Plans will be announced before any charge." },
        { p: "Does the AI learn from students' work?", r: "No. We use Google's paid AI, which doesn't train on submitted content. Handback learns your criteria only inside your account." },
        { p: "Does it work on my phone?", r: "Yes. Handback was designed mobile-first, with notifications." },
        { p: "What happens to students' data?", r: "It stays in your account. Before going to the AI we replace names with a code and hide email, phone and ID numbers (you can turn this off). We never use the work to train AI or for anything else, and you can ask for deletion." },
        { p: "Do you use cookies?", r: "Only the necessary ones: keeping you signed in, remembering the chosen class and the light or dark theme. No advertising or tracking cookies." },
      ],
    },
    transparencia: {
      selo: "Transparency",
      titulo: "What we ask, what we do and what we don't do",
      pedimos: {
        titulo: "What we ask",
        itens: [
          "Your email and a password, to create the account.",
          "Permission to connect your own Classroom, Moodle or email. You choose, and can disconnect any time.",
          "The checklist and criteria for each task.",
          "Your students' names, only to organize submissions.",
        ],
      },
      fazemos: {
        titulo: "What we do",
        itens: [
          "We use AI to check the checklist and write a draft.",
          "We replace the student's name with a code and hide email, phone and ID numbers before sending to the AI (you can turn this off).",
          "We keep a record of what the AI suggested and what you decided.",
          "We keep files in a private area, with expiring links.",
        ],
      },
      naoFazemos: {
        titulo: "What we don't do",
        itens: [
          "We don't decide grades or send feedback without your approval.",
          "We don't use students' work to train AI.",
          "We don't sell data or show ads.",
          "We don't read your inbox: Gmail only sends.",
          "We don't send personal documents (ID, tax numbers) to the AI.",
          "We don't use advertising or tracking cookies.",
        ],
      },
    },
    final: { titulo: "Grade your next class with Handback", texto: "Tell us how you work. We'll set everything up for your first delivery.", botao: "Request a trial" },
    rodape: { privacidade: "Privacy policy", termos: "Terms of use", cookies: "Cookies", contato: "Contact", aviso: "The app is currently in Portuguese; English is coming soon." },
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
      titulo1: "Tú recibes, la IA prepara el borrador,",
      titulo2: "tú decides.",
      texto:
        "Las entregas llegan solas desde Google Classroom, Moodle o correo. La IA revisa la lista que pediste y redacta un borrador de la retroalimentación. Tú eliges la nota, revisas y firmas. Nada sale sin ti.",
      testar: "Quiero probar",
      verComo: "Ver cómo funciona",
      funcionaCom: "Funciona con:",
      integracoes: "Google Classroom · Moodle · Correo · Google Drive · Google Calendar",
    },
    previa: {
      ciclo: "Entrega 3 · Derivadas",
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
      ia: "Borrador de la IA · la nota es tuya",
      aprovar: "Aprobar y siguiente",
    },
    como: {
      titulo: "Cada entrega en 5 pasos. Siempre sabes el siguiente.",
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
        { titulo: "Nada sale sin tu aprobación", texto: "La IA solo prepara el borrador. La nota y la firma son tuyas: puedes apagar la sugerencia de nota y verlo todo en el registro de supervisión." },
        { titulo: "Piloto automático", texto: "Actívalo en un grupo y lo que llega se analiza al instante. Recibes un aviso cuando está listo." },
        { titulo: "Sigue al grupo", texto: "Quién mejoró, quién bajó y quién necesita atención a lo largo de las entregas, con informe en PDF." },
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
        { p: "¿La IA corrige sola?", r: "No. La IA prepara un borrador. Tú eliges la nota, revisas y firmas cada retroalimentación antes de enviarla." },
        { p: "¿El estudiante necesita una cuenta?", r: "No. Entrega como ya lo hace: en Google Classroom, en Moodle o enviando un correo a la dirección del grupo." },
        { p: "¿Funciona con mi escuela?", r: "Funciona con Google Classroom, con el Moodle de tu institución y con correo. Cada profesor conecta su propia cuenta." },
        { p: "¿Cuánto cuesta?", r: "Por ahora es gratis para los primeros profesores, sin tarjeta. Los planes se anunciarán antes de cualquier cobro." },
        { p: "¿La IA aprende de los trabajos?", r: "No. Usamos la IA de pago de Google, que no entrena con el contenido enviado. Handback aprende tu criterio solo dentro de tu cuenta." },
        { p: "¿Funciona en el celular?", r: "Sí. Handback fue pensado primero para el celular, con avisos." },
        { p: "¿Qué pasa con los datos de los estudiantes?", r: "Quedan en tu cuenta. Antes de ir a la IA cambiamos el nombre por un código y ocultamos correo, teléfono y documentos (puedes apagarlo). No usamos los trabajos para entrenar IA ni para nada más, y puedes pedir la eliminación." },
        { p: "¿Usan cookies?", r: "Solo las necesarias: mantener tu sesión, recordar el grupo elegido y el tema claro u oscuro. Sin cookies de publicidad ni de rastreo." },
      ],
    },
    transparencia: {
      selo: "Transparencia",
      titulo: "Lo que pedimos, lo que hacemos y lo que no hacemos",
      pedimos: {
        titulo: "Lo que pedimos",
        itens: [
          "Tu correo y una contraseña, para crear la cuenta.",
          "Permiso para conectar tu propio Classroom, Moodle o correo. Tú eliges y puedes desconectar cuando quieras.",
          "La lista y los criterios de cada tarea.",
          "Los nombres de los estudiantes, solo para organizar las entregas.",
        ],
      },
      fazemos: {
        titulo: "Lo que hacemos",
        itens: [
          "Usamos la IA para revisar la lista y escribir un borrador.",
          "Cambiamos el nombre del estudiante por un código y ocultamos correo, teléfono y documentos antes de enviar a la IA (puedes apagarlo).",
          "Guardamos el registro de lo que la IA sugirió y de lo que tú decidiste.",
          "Guardamos los archivos en un área privada, con enlaces que caducan.",
        ],
      },
      naoFazemos: {
        titulo: "Lo que no hacemos",
        itens: [
          "No decidimos notas ni enviamos retroalimentación sin tu aprobación.",
          "No usamos los trabajos de los estudiantes para entrenar IA.",
          "No vendemos datos ni mostramos anuncios.",
          "No leemos tu bandeja de entrada: Gmail solo envía.",
          "No enviamos documentos personales a la IA.",
          "No usamos cookies de publicidad ni de rastreo.",
        ],
      },
    },
    final: { titulo: "Corrige tu próximo grupo con Handback", texto: "Cuéntanos cómo trabajas. Preparamos todo para tu primera entrega.", botao: "Quiero probar" },
    rodape: { privacidade: "Política de privacidad", termos: "Términos de uso", cookies: "Cookies", contato: "Contacto", aviso: "La aplicación está en portugués por ahora; el español llegará pronto." },
    assuntoEmail: "Quiero probar Handback",
  },
};

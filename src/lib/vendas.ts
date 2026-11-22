/** Textos da página de vendas em português, inglês e espanhol. */

export type Idioma = "pt" | "en" | "es";

export const IDIOMAS: { id: Idioma; sigla: string; nome: string; caminho: string; html: string }[] = [
  { id: "pt", sigla: "PT", nome: "Português", caminho: "/", html: "pt-BR" },
  { id: "en", sigla: "EN", nome: "English", caminho: "/en", html: "en" },
  { id: "es", sigla: "ES", nome: "Español", caminho: "/es", html: "es" },
];

type Item = { titulo: string; texto: string };

export type TextosVendas = {
  meta: { titulo: string; descricao: string };
  menu: { como: string; recursos: string; seguranca: string; perguntas: string; entrar: string };
  hero: { selo: string; titulo1: string; titulo2: string; texto: string; testar: string; entrar: string; nota: string };
  previa: {
    equipe: string;
    etapa: string;
    conceito: string;
    conceitoValor: string;
    pedido: string;
    itens: { item: string; status: "ok" | "parcial" | "falta"; nota: string }[];
    devolutiva: string;
    devolutivaTexto: string;
    aprovar: string;
    ia: string;
  };
  dor: { titulo: string; itens: Item[] };
  como: { titulo: string; passos: Item[] };
  paraQuem: { titulo: string; itens: Item[] };
  recursos: { titulo: string; itens: Item[] };
  seguranca: { titulo: string; texto: string; itens: string[]; politica: string };
  planos: { titulo: string; texto: string; botao: string };
  perguntas: { titulo: string; itens: { p: string; r: string }[] };
  final: { titulo: string; texto: string; botao: string };
  rodape: { privacidade: string; termos: string; aviso: string };
  assuntoEmail: string;
};

export const TEXTOS: Record<Idioma, TextosVendas> = {
  pt: {
    meta: {
      titulo: "Handback · Entregas conferidas com IA, aprovadas por você",
      descricao:
        "O Handback recebe as entregas por e-mail, confere com IA o que foi pedido e prepara a devolutiva. Você revisa, aprova e ela sai do seu próprio e-mail.",
    },
    menu: { como: "Como funciona", recursos: "Recursos", seguranca: "Segurança", perguntas: "Dúvidas", entrar: "Entrar" },
    hero: {
      selo: "Para professores, mentores, gestores e consultores",
      titulo1: "Você recebe,",
      titulo2: "a gente devolve conferido.",
      texto:
        "O Handback recebe as entregas por e-mail, confere com IA o que foi pedido e escreve um rascunho de devolutiva. Você revisa, aprova, e ela sai do seu próprio e-mail. Nada vai sem a sua aprovação.",
      testar: "Quero testar",
      entrar: "Já tenho conta",
      nota: "Quem entrega não precisa criar conta: só manda um e-mail.",
    },
    previa: {
      equipe: "Equipe Azul",
      etapa: "Aula 3 · Protótipo",
      conceito: "Conceito",
      conceitoValor: "BOM",
      pedido: "O que foi pedido",
      itens: [
        { item: "Protótipo navegável", status: "ok", nota: "Link do Figma no e-mail" },
        { item: "Roteiro de teste", status: "parcial", nota: "Tem as tarefas, faltam as perguntas" },
        { item: "Relatório com 5 usuários", status: "ok", nota: "PDF, páginas 2 a 6" },
      ],
      devolutiva: "Devolutiva",
      devolutivaTexto: "Pessoal, boa entrega! O protótipo está claro e o relatório traz evidências reais. Para a próxima, completem o roteiro com as perguntas de cada tarefa…",
      aprovar: "Aprovar e enviar",
      ia: "Sugerido pela IA · você decide",
    },
    dor: {
      titulo: "Corrigir entregas não deveria tomar o seu fim de semana",
      itens: [
        { titulo: "Caixa de entrada lotada", texto: "Arquivos, links e respostas misturados no e-mail, cada um com um nome diferente." },
        { titulo: "Conferência repetitiva", texto: "Abrir um por um para ver se entregaram tudo o que foi pedido." },
        { titulo: "Devolutiva que atrasa", texto: "Escrever um retorno bom para cada equipe leva tempo, e ele chega tarde." },
      ],
    },
    como: {
      titulo: "Como funciona",
      passos: [
        { titulo: "Recebe", texto: "Quem entrega manda um e-mail para o endereço da turma. O Handback separa por etapa e por grupo ou pessoa, sozinho." },
        { titulo: "Confere", texto: "A IA lê arquivos, PDFs, fotos e links e confere item por item o que foi pedido, sem dar nota." },
        { titulo: "Você aprova", texto: "Você vê o conceito sugerido, o checklist e a devolutiva pronta. Ajusta o que quiser e aprova." },
        { titulo: "Devolve", texto: "A devolutiva sai do seu Gmail, na mesma conversa do e-mail da entrega. A evolução de cada um fica registrada." },
      ],
    },
    paraQuem: {
      titulo: "Para quem é",
      itens: [
        { titulo: "Universidades e escolas", texto: "Turmas com alunos individuais ou em grupos." },
        { titulo: "Hubs e residências", texto: "Programas com times de residentes e ciclos de entrega." },
        { titulo: "Consultorias", texto: "Equipes de projeto entregando para revisão." },
        { titulo: "Empresas", texto: "Times entregando para o gestor, sprint a sprint." },
        { titulo: "Escritórios", texto: "Clientes enviando o que foi pedido no mês." },
      ],
    },
    recursos: {
      titulo: "Tudo o que você precisa, sem complicar",
      itens: [
        { titulo: "Conceitos, não notas", texto: "Excelente, Bom, Regular ou Ruim, com a definição de cada um feita por você." },
        { titulo: "Checklist automático", texto: "Cada item pedido aparece como entregue, parcial ou faltando, com onde a IA encontrou." },
        { titulo: "Devolutiva no seu tom", texto: "A IA aprende com as devolutivas que você aprova e com os motivos quando você muda o conceito." },
        { titulo: "Turmas e programas", texto: "Várias turmas na mesma conta, cada uma com o próprio endereço de entrega." },
        { titulo: "Evolução e relatório", texto: "Veja quem melhorou, quem caiu e quem precisa de atenção. Relatório da aula pronto para imprimir." },
        { titulo: "Com as palavras de vocês", texto: "Aula, ciclo, sprint; equipe, time, aluno, residente: o Handback fala do seu jeito." },
      ],
    },
    seguranca: {
      titulo: "Feito para documentos importantes",
      texto: "Empresas e escolas confiam ao Handback trabalhos, relatórios e documentos. Por isso, segurança vem de fábrica.",
      itens: [
        "Senha forte e verificação em duas etapas (código no celular)",
        "Cada empresa só enxerga os próprios dados",
        "Arquivos em área privada, com links que expiram",
        "Registro de quem abriu, baixou, aprovou ou enviou cada coisa",
        "A IA usada não treina com os seus dados",
        "Seu Gmail só envia: o Handback pede ao Google só a permissão de enviar e-mails e nunca lê a sua caixa",
      ],
      politica: "Leia a política de privacidade",
    },
    planos: {
      titulo: "Planos",
      texto: "Estamos abrindo os primeiros pilotos com condições especiais. Conte como você vai usar e montamos o plano com você.",
      botao: "Falar com a gente",
    },
    perguntas: {
      titulo: "Perguntas frequentes",
      itens: [
        { p: "Quem entrega precisa criar conta?", r: "Não. A pessoa só manda um e-mail para o endereço da turma, com os arquivos ou links." },
        { p: "A IA dá nota?", r: "Não. O Handback usa conceitos (Excelente, Bom, Regular, Ruim), e quem decide o conceito final é você." },
        { p: "A devolutiva sai sozinha?", r: "Nunca. Uma pessoa revisa e aprova cada devolutiva antes do envio." },
        { p: "Preciso usar Gmail?", r: "Para enviar a devolutiva do seu próprio e-mail, sim. Sem Gmail, você copia o texto pronto e envia como preferir." },
        { p: "A IA aprende com os trabalhos dos alunos?", r: "Não. Usamos a IA paga do Google, que não treina com o conteúdo enviado. O Handback aprende o seu critério só dentro da sua conta." },
        { p: "Funciona no celular?", r: "Sim. O Handback foi pensado primeiro para o celular." },
      ],
    },
    final: { titulo: "Pronto para devolver mais rápido?", texto: "Conte para a gente como você trabalha. A gente prepara tudo para o seu primeiro ciclo.", botao: "Quero testar" },
    rodape: { privacidade: "Política de privacidade", termos: "Termos de uso", aviso: "" },
    assuntoEmail: "Quero testar o Handback",
  },
  en: {
    meta: {
      titulo: "Handback · Submissions checked by AI, approved by you",
      descricao:
        "Handback receives submissions by email, checks what was requested with AI and drafts the feedback. You review, approve, and it goes out from your own email.",
    },
    menu: { como: "How it works", recursos: "Features", seguranca: "Security", perguntas: "FAQ", entrar: "Sign in" },
    hero: {
      selo: "For teachers, mentors, managers and consultants",
      titulo1: "You receive it,",
      titulo2: "we hand it back checked.",
      texto:
        "Handback receives submissions by email, checks what was requested with AI and drafts the feedback. You review, approve, and it goes out from your own email. Nothing is sent without your approval.",
      testar: "Request a trial",
      entrar: "I have an account",
      nota: "Submitters don't need an account: they just send an email.",
    },
    previa: {
      equipe: "Blue Team",
      etapa: "Class 3 · Prototype",
      conceito: "Grade",
      conceitoValor: "GOOD",
      pedido: "What was requested",
      itens: [
        { item: "Clickable prototype", status: "ok", nota: "Figma link in the email" },
        { item: "Test script", status: "parcial", nota: "Has the tasks, questions missing" },
        { item: "Report with 5 users", status: "ok", nota: "PDF, pages 2 to 6" },
      ],
      devolutiva: "Feedback",
      devolutivaTexto: "Great work, team! The prototype is clear and the report brings real evidence. Next time, complete the script with the questions for each task…",
      aprovar: "Approve and send",
      ia: "Suggested by AI · you decide",
    },
    dor: {
      titulo: "Grading submissions shouldn't take your weekend",
      itens: [
        { titulo: "An overflowing inbox", texto: "Files, links and replies mixed together, each one named differently." },
        { titulo: "Repetitive checking", texto: "Opening them one by one to see if everything requested was delivered." },
        { titulo: "Late feedback", texto: "Writing good feedback for every team takes time, and it arrives late." },
      ],
    },
    como: {
      titulo: "How it works",
      passos: [
        { titulo: "Receive", texto: "Submitters email the class address. Handback sorts by stage and by group or person, on its own." },
        { titulo: "Check", texto: "AI reads files, PDFs, photos and links and checks every requested item, without numeric grades." },
        { titulo: "You approve", texto: "See the suggested grade, the checklist and ready-to-send feedback. Adjust anything and approve." },
        { titulo: "Hand back", texto: "Feedback goes out from your Gmail, in the same thread as the submission. Everyone's progress is recorded." },
      ],
    },
    paraQuem: {
      titulo: "Who it's for",
      itens: [
        { titulo: "Universities and schools", texto: "Classes with individual students or groups." },
        { titulo: "Hubs and residencies", texto: "Programs with resident teams and delivery cycles." },
        { titulo: "Consulting firms", texto: "Project teams submitting work for review." },
        { titulo: "Companies", texto: "Teams delivering to their manager, sprint by sprint." },
        { titulo: "Professional offices", texto: "Clients sending what was requested each month." },
      ],
    },
    recursos: {
      titulo: "Everything you need, nothing you don't",
      itens: [
        { titulo: "Levels, not scores", texto: "Excellent, Good, Fair or Poor, each one defined by you." },
        { titulo: "Automatic checklist", texto: "Each requested item shows as delivered, partial or missing, with where the AI found it." },
        { titulo: "Feedback in your voice", texto: "AI learns from the feedback you approve and from your reasons when you change a grade." },
        { titulo: "Classes and programs", texto: "Several classes in one account, each with its own submission address." },
        { titulo: "Progress and reports", texto: "See who improved, who dropped and who needs attention. Class report ready to print." },
        { titulo: "Your own words", texto: "Class, cycle, sprint; team, group, student, resident: Handback speaks your language." },
      ],
    },
    seguranca: {
      titulo: "Built for important documents",
      texto: "Schools and companies trust Handback with assignments, reports and documents. That's why security comes built in.",
      itens: [
        "Strong passwords and two-step verification (code on your phone)",
        "Each organization only sees its own data",
        "Files kept private, with expiring links",
        "Log of who opened, downloaded, approved or sent each item",
        "The AI we use doesn't train on your data",
        "Your Gmail only sends: Handback asks Google only for permission to send email and never reads your inbox",
      ],
      politica: "Read the privacy policy (Portuguese)",
    },
    planos: {
      titulo: "Pricing",
      texto: "We're opening our first pilots with special terms. Tell us how you'll use it and we'll build the plan with you.",
      botao: "Talk to us",
    },
    perguntas: {
      titulo: "Frequently asked questions",
      itens: [
        { p: "Do submitters need an account?", r: "No. They just send an email to the class address, with files or links." },
        { p: "Does the AI give numeric grades?", r: "No. Handback uses levels (Excellent, Good, Fair, Poor), and you decide the final one." },
        { p: "Is feedback sent automatically?", r: "Never. A person reviews and approves every piece of feedback before it's sent." },
        { p: "Do I need Gmail?", r: "To send feedback from your own email, yes. Without Gmail, you copy the ready text and send it as you prefer." },
        { p: "Does the AI learn from students' work?", r: "No. We use Google's paid AI, which doesn't train on submitted content. Handback learns your criteria only inside your account." },
        { p: "Does it work on mobile?", r: "Yes. Handback was designed mobile-first." },
      ],
    },
    final: { titulo: "Ready to hand back faster?", texto: "Tell us how you work. We'll set everything up for your first cycle.", botao: "Request a trial" },
    rodape: { privacidade: "Privacy policy", termos: "Terms of use", aviso: "The app is currently in Portuguese; English is coming soon." },
    assuntoEmail: "Handback trial request",
  },
  es: {
    meta: {
      titulo: "Handback · Entregas revisadas con IA, aprobadas por ti",
      descricao:
        "Handback recibe las entregas por correo, revisa con IA lo que se pidió y prepara la retroalimentación. Tú revisas, apruebas y sale desde tu propio correo.",
    },
    menu: { como: "Cómo funciona", recursos: "Funciones", seguranca: "Seguridad", perguntas: "Preguntas", entrar: "Entrar" },
    hero: {
      selo: "Para profesores, mentores, gerentes y consultores",
      titulo1: "Tú recibes,",
      titulo2: "nosotros devolvemos revisado.",
      texto:
        "Handback recibe las entregas por correo, revisa con IA lo que se pidió y redacta la retroalimentación. Tú revisas, apruebas y sale desde tu propio correo. Nada se envía sin tu aprobación.",
      testar: "Quiero probar",
      entrar: "Ya tengo cuenta",
      nota: "Quien entrega no necesita crear cuenta: solo envía un correo.",
    },
    previa: {
      equipe: "Equipo Azul",
      etapa: "Clase 3 · Prototipo",
      conceito: "Concepto",
      conceitoValor: "BUENO",
      pedido: "Lo que se pidió",
      itens: [
        { item: "Prototipo navegable", status: "ok", nota: "Enlace de Figma en el correo" },
        { item: "Guion de prueba", status: "parcial", nota: "Tiene las tareas, faltan las preguntas" },
        { item: "Informe con 5 usuarios", status: "ok", nota: "PDF, páginas 2 a 6" },
      ],
      devolutiva: "Retroalimentación",
      devolutivaTexto: "¡Buen trabajo, equipo! El prototipo es claro y el informe trae evidencia real. Para la próxima, completen el guion con las preguntas de cada tarea…",
      aprovar: "Aprobar y enviar",
      ia: "Sugerido por la IA · tú decides",
    },
    dor: {
      titulo: "Revisar entregas no debería ocupar tu fin de semana",
      itens: [
        { titulo: "Bandeja de entrada llena", texto: "Archivos, enlaces y respuestas mezclados, cada uno con un nombre distinto." },
        { titulo: "Revisión repetitiva", texto: "Abrir una por una para ver si entregaron todo lo que se pidió." },
        { titulo: "Retroalimentación tardía", texto: "Escribir una buena respuesta para cada equipo lleva tiempo, y llega tarde." },
      ],
    },
    como: {
      titulo: "Cómo funciona",
      passos: [
        { titulo: "Recibe", texto: "Quien entrega envía un correo a la dirección del grupo. Handback ordena por etapa y por equipo o persona, solo." },
        { titulo: "Revisa", texto: "La IA lee archivos, PDFs, fotos y enlaces y revisa cada ítem pedido, sin notas numéricas." },
        { titulo: "Tú apruebas", texto: "Ves el concepto sugerido, el checklist y la retroalimentación lista. Ajustas lo que quieras y apruebas." },
        { titulo: "Devuelve", texto: "La retroalimentación sale de tu Gmail, en la misma conversación de la entrega. La evolución de cada uno queda registrada." },
      ],
    },
    paraQuem: {
      titulo: "Para quién es",
      itens: [
        { titulo: "Universidades y escuelas", texto: "Grupos con alumnos individuales o en equipos." },
        { titulo: "Hubs y residencias", texto: "Programas con equipos de residentes y ciclos de entrega." },
        { titulo: "Consultoras", texto: "Equipos de proyecto que entregan para revisión." },
        { titulo: "Empresas", texto: "Equipos que entregan al gerente, sprint a sprint." },
        { titulo: "Despachos", texto: "Clientes que envían lo que se pidió cada mes." },
      ],
    },
    recursos: {
      titulo: "Todo lo que necesitas, sin complicaciones",
      itens: [
        { titulo: "Conceptos, no notas", texto: "Excelente, Bueno, Regular o Malo, con la definición de cada uno hecha por ti." },
        { titulo: "Checklist automático", texto: "Cada ítem pedido aparece como entregado, parcial o faltante, con dónde lo encontró la IA." },
        { titulo: "Retroalimentación con tu tono", texto: "La IA aprende de las respuestas que apruebas y de tus motivos cuando cambias un concepto." },
        { titulo: "Grupos y programas", texto: "Varios grupos en la misma cuenta, cada uno con su propia dirección de entrega." },
        { titulo: "Evolución e informe", texto: "Mira quién mejoró, quién bajó y quién necesita atención. Informe de la clase listo para imprimir." },
        { titulo: "Con sus propias palabras", texto: "Clase, ciclo, sprint; equipo, alumno, residente: Handback habla como ustedes." },
      ],
    },
    seguranca: {
      titulo: "Hecho para documentos importantes",
      texto: "Escuelas y empresas confían a Handback trabajos, informes y documentos. Por eso, la seguridad viene de fábrica.",
      itens: [
        "Contraseña fuerte y verificación en dos pasos (código en el celular)",
        "Cada organización solo ve sus propios datos",
        "Archivos en un área privada, con enlaces que caducan",
        "Registro de quién abrió, descargó, aprobó o envió cada cosa",
        "La IA que usamos no se entrena con tus datos",
        "Tu Gmail solo envía: Handback pide a Google solo el permiso de enviar correos y nunca lee tu bandeja",
      ],
      politica: "Lee la política de privacidad (en portugués)",
    },
    planos: {
      titulo: "Planes",
      texto: "Estamos abriendo los primeros pilotos con condiciones especiales. Cuéntanos cómo lo vas a usar y armamos el plan contigo.",
      botao: "Hablar con nosotros",
    },
    perguntas: {
      titulo: "Preguntas frecuentes",
      itens: [
        { p: "¿Quien entrega necesita crear una cuenta?", r: "No. Solo envía un correo a la dirección del grupo, con los archivos o enlaces." },
        { p: "¿La IA pone notas?", r: "No. Handback usa conceptos (Excelente, Bueno, Regular, Malo), y el concepto final lo decides tú." },
        { p: "¿La retroalimentación se envía sola?", r: "Nunca. Una persona revisa y aprueba cada respuesta antes del envío." },
        { p: "¿Necesito Gmail?", r: "Para enviar desde tu propio correo, sí. Sin Gmail, copias el texto listo y lo envías como prefieras." },
        { p: "¿La IA aprende con los trabajos de los alumnos?", r: "No. Usamos la IA de pago de Google, que no se entrena con el contenido enviado. Handback aprende tu criterio solo dentro de tu cuenta." },
        { p: "¿Funciona en el celular?", r: "Sí. Handback se pensó primero para el celular." },
      ],
    },
    final: { titulo: "¿Listo para devolver más rápido?", texto: "Cuéntanos cómo trabajas. Preparamos todo para tu primer ciclo.", botao: "Quiero probar" },
    rodape: { privacidade: "Política de privacidad", termos: "Términos de uso", aviso: "La aplicación está en portugués por ahora; el español llegará pronto." },
    assuntoEmail: "Quiero probar Handback",
  },
};

import { limites, nivel, type Uso } from "@/lib/limites";
import { tamanhoLegivel } from "@/lib/textos";

type Linha = { nome: string; servico: string; usado: number; limite: number; texto: string; dica: string };

const COR = {
  ok: { barra: "bg-marca", selo: "bg-marca-clara text-marca-forte", nome: "Tranquilo" },
  atencao: { barra: "bg-[#d99a00]", selo: "bg-alerta-fundo text-alerta", nome: "Atenção" },
  cheio: { barra: "bg-erro", selo: "bg-erro-fundo text-erro", nome: "Quase cheio" },
} as const;

/** Quanto já foi usado de cada limite dos planos (só números da plataforma inteira). */
export function PainelUso({ uso }: { uso: Uso }) {
  const l = limites();
  const linhas: Linha[] = [
    {
      nome: "Arquivos das entregas",
      servico: "Supabase",
      usado: uso.arquivos_bytes,
      limite: l.arquivosBytes,
      texto: `${tamanhoLegivel(uso.arquivos_bytes)} de ${tamanhoLegivel(l.arquivosBytes)}`,
      dica: "É o primeiro a encher. Com o Supabase Pro passa para 100 GB (e ganha backup diário).",
    },
    {
      nome: "Análises de IA hoje",
      servico: "Gemini",
      usado: uso.analises_hoje,
      limite: l.analisesDia,
      texto: `${uso.analises_hoje} de ~${l.analisesDia} · ${uso.analises_mes} no mês`,
      dica: "Volta a zero todo dia. Com o faturamento do Gemini ativo, o limite diário deixa de ser problema (custa centavos).",
    },
    {
      nome: "E-mails de entrega hoje",
      servico: "Resend",
      usado: uso.emails_hoje,
      limite: l.emailsDia,
      texto: `${uso.emails_hoje} de ${l.emailsDia} · ${uso.emails_mes} de ${l.emailsMes} no mês`,
      dica: "Entregas que chegam por e-mail. As do Moodle não contam aqui.",
    },
    {
      nome: "E-mails de login na última hora",
      servico: "Supabase",
      usado: uso.emails_login_hora ?? 0,
      limite: l.emailsLoginHora,
      texto: uso.emails_login_hora === null ? "sem dados" : `${uso.emails_login_hora} de ~${l.emailsLoginHora}`,
      dica: "Convites, cadastros e senha nova. Com a conta de suporte no Gmail (SMTP), passa para centenas por dia.",
    },
    {
      nome: "Gmails conectados",
      servico: "Google",
      usado: uso.gmails_conectados,
      limite: l.gmails,
      texto: `${uso.gmails_conectados} de ${l.gmails}`,
      dica: "Enquanto o app estiver “em teste” no Google, só até 100 pessoas da lista de testadores. A verificação do Google tira esse limite.",
    },
    {
      nome: "Banco de dados",
      servico: "Supabase",
      usado: uso.banco_bytes,
      limite: l.bancoBytes,
      texto: `${tamanhoLegivel(uso.banco_bytes)} de ${tamanhoLegivel(l.bancoBytes)}`,
      dica: "Textos, devolutivas e registros. Cabe muita coisa.",
    },
    {
      nome: "Pessoas com conta",
      servico: "Supabase",
      usado: uso.pessoas,
      limite: l.pessoas,
      texto: `${uso.pessoas} em ${uso.espacos} espaço(s)`,
      dica: "Folgado: o limite grátis é de 50 mil pessoas por mês.",
    },
  ];

  return (
    <section aria-label="Uso dos planos" className="flex flex-col gap-3">
      <div>
        <h2 className="font-semibold">Uso dos planos</h2>
        <p className="text-sm text-suave">Números aproximados da plataforma inteira. Os limites são os dos planos grátis; atualize quando mudar de plano.</p>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {linhas.map((x) => {
          const n = nivel(x.usado, x.limite);
          const c = COR[n];
          const pct = Math.min(100, x.limite > 0 ? Math.round((x.usado / x.limite) * 100) : 0);
          return (
            <li key={x.nome} className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="flex flex-col">
                  <span className="font-semibold">{x.nome}</span>
                  <span className="text-xs text-suave">{x.servico}</span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${c.selo}`}>{c.nome}</span>
              </div>
              <div
                role="meter"
                aria-label={x.nome}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                className="h-2.5 overflow-hidden rounded-full bg-neutro-fundo"
              >
                <div className={`h-full rounded-full transition-[width] duration-700 ${c.barra}`} style={{ width: `${Math.max(pct, x.usado > 0 ? 2 : 0)}%` }} />
              </div>
              <span className="text-sm">{x.texto}</span>
              <span className="text-xs text-suave">{x.dica}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

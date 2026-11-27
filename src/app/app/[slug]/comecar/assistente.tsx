"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Aviso, Botao } from "@/components/ui";
import { generoDe, OPCOES_NOMES, plural, USOS, type Modo } from "@/lib/nomes";
import { EscolhasIACampos } from "@/components/escolhas-ia";
import { ESCOLHAS_PADRAO, type EscolhasIA } from "@/lib/ia/escolhas";
import { concluirPrimeiroAcesso } from "./acoes";

type Campo = "espaco" | "grupo" | "pessoa" | "etapa";
const OUTRO = "__outro";

function Chip({ marcado, onClick, children }: { marcado: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={marcado}
      onClick={onClick}
      className={`min-h-10 rounded-full px-3.5 text-sm font-semibold ${
        marcado ? "border-2 border-marca bg-marca-clara text-marca-forte" : "border border-borda bg-cartao text-suave hover:text-texto"
      }`}
    >
      {children}
    </button>
  );
}

function Opcao({ marcado, onClick, titulo, texto, extra }: { marcado: boolean; onClick: () => void; titulo: string; texto: string; extra?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcado}
      onClick={onClick}
      className={`flex w-full flex-col items-start gap-1 rounded-2xl p-4 text-left ${marcado ? "border-2 border-marca bg-marca-clara/50" : "border border-borda bg-cartao hover:border-marca"}`}
    >
      <span className="font-semibold">{titulo}</span>
      <span className="text-sm text-suave">{texto}</span>
      {extra ? <span className="text-xs font-semibold text-marca-forte">{extra}</span> : null}
    </button>
  );
}

export function Assistente({ slug }: { slug: string }) {
  const [passo, setPasso] = useState(1);
  const router = useRouter();
  const [usoId, setUsoId] = useState(USOS[0].id);
  const [modo, setModo] = useState<Modo>(USOS[0].modo);
  const [nomes, setNomes] = useState<Record<Campo, string>>({ espaco: USOS[0].espaco, grupo: USOS[0].grupo, pessoa: USOS[0].pessoa, etapa: USOS[0].etapa });
  const [outros, setOutros] = useState<Record<Campo, string>>({ espaco: "", grupo: "", pessoa: "", etapa: "" });
  const [nomeTurma, setNomeTurma] = useState("");
  const [ia, setIa] = useState<EscolhasIA>(ESCOLHAS_PADRAO);
  const [erro, setErro] = useState("");
  const [salvando, iniciar] = useTransition();
  const uso = USOS.find((u) => u.id === usoId)!;
  const valor = (c: Campo) => (nomes[c] === OUTRO ? outros[c].trim() : nomes[c]);
  const individual = modo === "individual";
  const campos: Campo[] = individual ? ["espaco", "pessoa", "etapa"] : ["espaco", "grupo", "pessoa", "etapa"];
  const perguntas: Record<Campo, string> = {
    espaco: "Cada turma, programa ou projeto",
    grupo: "Os grupos que entregam",
    pessoa: individual ? "Quem entrega" : "As pessoas dentro de cada grupo",
    etapa: "Cada etapa de entrega",
  };
  const esp = valor("espaco") || "…";
  const fem = generoDe(esp) === "f";
  const total = 5;

  function escolherUso(id: string) {
    const u = USOS.find((x) => x.id === id)!;
    setUsoId(id);
    setModo(u.modo);
    setNomes({ espaco: u.espaco, grupo: u.grupo, pessoa: u.pessoa, etapa: u.etapa });
    setOutros({ espaco: "", grupo: "", pessoa: "", etapa: "" });
  }

  function continuar() {
    setErro("");
    if (passo === 3 && campos.some((c) => !valor(c))) return setErro("Escreva o nome em “Outro…” ou escolha uma opção.");
    if (passo < total) return setPasso(passo + 1);
    if (!nomeTurma.trim()) return setErro("Dê um nome.");
    iniciar(async () => {
      const r = await concluirPrimeiroAcesso(slug, {
        uso: usoId,
        modo,
        espaco: valor("espaco"),
        grupo: valor("grupo") || uso.grupo,
        pessoa: valor("pessoa"),
        etapa: valor("etapa"),
        nomeTurma,
        ia,
      });
      // Pronto: segue direto para as Configurações, com a lista dos primeiros passos.
      if (r.ok) router.push(`/app/${slug}/configuracoes`);
      else setErro(r.mensagem);
    });
  }

  const etapa = valor("etapa") || "…";
  const proximos = [
    { titulo: `Criar ${generoDe(etapa) === "f" ? "a primeira" : "o primeiro"} ${etapa.toLowerCase()}`, texto: "Prazo e o que deve ser entregue (o checklist)", href: `/app/${slug}/etapas/nova` },
    {
      titulo: `Cadastrar ${(individual ? plural(valor("pessoa")) : plural(valor("grupo"))).toLowerCase()}`,
      texto: individual ? "Cole a lista com nome e e-mail de uma vez" : "Nome de cada grupo e os e-mails de quem está nele",
      href: `/app/${slug}/grupos`,
    },
    { titulo: "Mandar o endereço de entrega", texto: "Copie a mensagem pronta e mande para quem entrega", href: `/app/${slug}/entregas/caixa` },
    { titulo: "Conectar seu Gmail", texto: "Para as devolutivas saírem do seu e-mail", href: `/app/${slug}/entregas` },
  ];

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-5">
      {passo <= total ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm text-suave">
            <span>Primeiro acesso</span>
            <span>
              Passo {passo} de {total}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutro-fundo">
            <div className="h-full rounded-full bg-marca transition-all" style={{ width: `${(passo / total) * 100}%` }} />
          </div>
        </div>
      ) : null}

      {passo === 1 ? (
        <>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Para que você vai usar o Handback?</h2>
            <p className="text-sm text-suave">Assim já deixamos tudo com as palavras que vocês usam.</p>
          </div>
          <div role="radiogroup" aria-label="Tipo de uso" className="flex flex-col gap-2">
            {USOS.map((u) => (
              <Opcao key={u.id} marcado={u.id === usoId} onClick={() => escolherUso(u.id)} titulo={u.nome} texto={u.descricao} />
            ))}
          </div>
        </>
      ) : null}

      {passo === 2 ? (
        <>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Quem entrega os trabalhos?</h2>
            <p className="text-sm text-suave">Dá para mudar depois em Ajustes, para cada turma.</p>
          </div>
          <div role="radiogroup" aria-label="Quem entrega" className="flex flex-col gap-2.5">
            <Opcao
              marcado={modo === "grupos"}
              onClick={() => setModo("grupos")}
              titulo="Grupos, com pessoas dentro"
              texto="Cada grupo entrega junto e recebe uma devolutiva só."
              extra="Ex.: times com residentes, equipes de consultores"
            />
            <Opcao
              marcado={modo === "individual"}
              onClick={() => setModo("individual")}
              titulo="Pessoas individuais"
              texto="Cada pessoa entrega o seu e recebe a própria devolutiva."
              extra="Ex.: uma sala com 40 alunos"
            />
          </div>
        </>
      ) : null}

      {passo === 3 ? (
        <>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Como vocês chamam…</h2>
            <p className="text-sm text-suave">Toque numa opção. Já sugerimos pelo tipo de uso.</p>
          </div>
          {campos.map((c) => (
            <fieldset key={c} className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">{perguntas[c]}</legend>
              <div className="flex flex-wrap gap-1.5">
                {[...OPCOES_NOMES[c], OUTRO].map((op) => (
                  <Chip key={op} marcado={nomes[c] === op} onClick={() => setNomes({ ...nomes, [c]: op })}>
                    {op === OUTRO ? "Outro…" : op}
                  </Chip>
                ))}
              </div>
              {nomes[c] === OUTRO ? (
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-suave">Digite no singular, o plural é automático</span>
                  <input
                    aria-label={`${perguntas[c]}: outro nome`}
                    value={outros[c]}
                    onChange={(e) => setOutros({ ...outros, [c]: e.target.value })}
                    maxLength={40}
                    placeholder="Ex.: Mentorado"
                    className="min-h-11 rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
                  />
                </label>
              ) : null}
            </fieldset>
          ))}
          <div className="flex flex-col gap-1 rounded-xl bg-marca-clara p-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-marca-forte">Assim vai aparecer</span>
            <span className="font-semibold">
              {individual
                ? `${esp} Cálculo I › ${etapa} 2 › 42 ${plural(valor("pessoa") || "…").toLowerCase()}`
                : `${esp} 2026 › ${etapa} 2 › ${valor("grupo") || "…"} Azul (5 ${plural(valor("pessoa") || "…").toLowerCase()})`}
            </span>
          </div>
        </>
      ) : null}

      {passo === 4 ? (
        <>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Como você quer usar a IA?</h2>
            <p className="text-sm text-suave">Estas escolhas são suas: o Handback só segue o que você marcar. Dá para mudar depois em Configurações, ou turma por turma.</p>
          </div>
          <EscolhasIACampos valores={ia} aoMudar={setIa} />
          <p className="rounded-xl bg-marca-clara px-3 py-2.5 text-xs leading-relaxed text-marca-forte">A decisão e a assinatura das devolutivas são sempre suas. A IA só prepara rascunhos. O Handback não usa os trabalhos dos alunos para treinar IA.</p>
        </>
      ) : null}

      {passo === 5 ? (
        <>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Crie {fem ? "sua primeira" : "seu primeiro"} {esp.toLowerCase()}
            </h2>
            <p className="text-sm text-suave">Depois você pode criar outras e trocar entre elas no topo. Os ajustes valem para todas.</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Nome</span>
            <input
              value={nomeTurma}
              onChange={(e) => setNomeTurma(e.target.value)}
              maxLength={120}
              placeholder={uso.exemploEspaco}
              className="min-h-12 rounded-xl border border-borda bg-cartao px-3 text-base text-texto"
            />
          </label>
        </>
      ) : null}

      {passo === 6 ? (
        <>
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-2xl font-bold tracking-tight">Tudo pronto!</h2>
            <p className="text-sm text-suave">Faltam só estes passos. Pode fazer agora ou depois.</p>
          </div>
          <ol className="flex flex-col gap-2">
            {proximos.map((p, i) => (
              <li key={p.href + i}>
                <Link href={p.href} className="flex items-center gap-3 rounded-2xl border border-borda bg-cartao p-3.5 hover:border-marca">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutro-fundo text-sm font-bold">{i + 1}</span>
                  <span className="flex flex-col">
                    <span className="font-semibold">{p.titulo}</span>
                    <span className="text-xs text-suave">{p.texto}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}
      {passo <= total ? (
        <div className="grid grid-cols-2 gap-2">
          {passo > 1 ? (
            <Botao type="button" variante="secundario" onClick={() => setPasso(passo - 1)} disabled={salvando}>
              Voltar
            </Botao>
          ) : (
            <span />
          )}
          <Botao type="button" onClick={continuar} disabled={salvando}>
            {salvando ? "Salvando…" : passo === total ? "Concluir" : "Continuar"}
          </Botao>
        </div>
      ) : null}
    </section>
  );
}

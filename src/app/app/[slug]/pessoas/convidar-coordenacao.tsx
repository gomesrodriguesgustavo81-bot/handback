"use client";

import { FormAcao } from "@/components/form-acao";
import { Campo } from "@/components/ui";
import { convidarCoordenacao } from "./acoes";

/** Convite de coordenador ou banca. Fica num componente do navegador porque a pergunta de confirmação usa o e-mail digitado. */
export function ConvidarCoordenacao({ slug, turmas }: { slug: string; turmas: { id: string; nome: string }[] }) {
  return (
    <FormAcao
      acao={convidarCoordenacao.bind(null, slug)}
      textoBotao="Enviar convite"
      limparAoSalvar
      confirmar={(d) => ({
        titulo: "Enviar o convite?",
        texto: `${String(d.get("email") ?? "")} vai receber um e-mail e poderá ver números e conceitos aprovados${d.get("tipo") === "banca" ? " só das turmas escolhidas" : " de todas as turmas"}. Não verá devolutivas nem arquivos${d.get("nomes") === "on" ? ", mas verá os nomes" : " e não verá nomes"}.`,
        sim: "Sim, enviar",
      })}
    >
      <Campo rotulo="E-mail da pessoa" name="email" type="email" inputMode="email" required placeholder="coordenacao@escola.com" />
      <fieldset className="flex flex-col gap-2 rounded-xl border border-borda p-3">
        <legend className="px-1 text-sm font-medium">Papel</legend>
        <label className="flex min-h-11 items-start gap-2.5 text-sm">
          <input type="radio" name="tipo" value="coordenador" defaultChecked className="mt-1 size-4" />
          <span>
            <b>Coordenador</b>
            <br />
            <span className="text-xs text-suave">Todas as turmas.</span>
          </span>
        </label>
        <label className="flex min-h-11 items-start gap-2.5 text-sm">
          <input type="radio" name="tipo" value="banca" className="mt-1 size-4" />
          <span>
            <b>Banca</b>
            <br />
            <span className="text-xs text-suave">Só as turmas marcadas abaixo.</span>
          </span>
        </label>
      </fieldset>
      {turmas.length ? (
        <fieldset className="flex flex-col gap-1 rounded-xl border border-borda p-3">
          <legend className="px-1 text-sm font-medium">Turmas da banca</legend>
          {turmas.map((t) => (
            <label key={t.id} className="flex min-h-11 items-center gap-2.5 text-sm">
              <input type="checkbox" name="turma" value={t.id} className="size-4" />
              {t.nome}
            </label>
          ))}
        </fieldset>
      ) : null}
      <label className="flex min-h-11 items-start gap-2.5 text-sm">
        <input type="checkbox" name="nomes" className="mt-1 size-4" />
        <span>
          <b>Mostrar nomes</b>
          <br />
          <span className="text-xs text-suave">Desligado, só aparecem os números da turma. Ligado, aparecem as pessoas ou equipes com o conceito aprovado.</span>
        </span>
      </label>
    </FormAcao>
  );
}

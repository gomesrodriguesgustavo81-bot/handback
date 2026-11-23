"use client";

import Link from "next/link";
import { useState } from "react";
import { SinalSalvo, useSalvar } from "@/components/campo-auto";
import { BotaoConfirmar } from "@/components/form-acao";
import { Selo } from "@/components/ui";
import { apagarGrupo, renomearGrupo } from "./acoes";

/** Um cadastro da lista, com renomear e apagar à mão (para quem administra). */
export function CartaoGrupo({
  slug,
  g,
  podeGerir,
  palavra,
  doMoodle,
}: {
  slug: string;
  g: { id: string; nome: string; tema: string | null; ativo: boolean; pessoas: string };
  podeGerir: boolean;
  palavra: string;
  doMoodle: boolean;
}) {
  const [renomeando, setRenomeando] = useState(false);
  const [nome, setNome] = useState(g.nome);
  const { salvar, estado, erro } = useSalvar(slug, `grupo-${g.id}`, g.nome, (v) => renomearGrupo(slug, g.id, v));
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-borda bg-cartao p-4">
      {renomeando ? (
        <label className="flex flex-col gap-1">
          <span className="flex items-center justify-between gap-2 text-xs text-suave">
            Novo nome
            <SinalSalvo estado={estado} erro={erro} />
          </span>
          <input
            autoFocus
            defaultValue={nome}
            maxLength={120}
            onChange={(e) => setNome(e.target.value)}
            onBlur={(e) => {
              salvar(e.target.value);
              setRenomeando(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenomeando(false);
            }}
            className="min-h-11 w-full rounded-xl border border-borda bg-cartao px-3 text-base font-semibold text-texto"
          />
        </label>
      ) : (
        <Link href={`/app/${slug}/grupos/${g.id}`} className="flex flex-col gap-1 hover:text-marca-forte">
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            {nome}
            {!g.ativo ? <Selo>Pausado</Selo> : null}
            {estado === "salvo" ? <SinalSalvo estado={estado} erro="" /> : null}
          </span>
          {g.tema ? <span className="text-sm text-texto">{g.tema}</span> : null}
          <span className="break-words text-sm text-suave">{g.pessoas}</span>
        </Link>
      )}
      {estado === "erro" && !renomeando ? <SinalSalvo estado={estado} erro={erro} /> : null}
      {podeGerir ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-2">
          <button
            type="button"
            onClick={() => setRenomeando(true)}
            className="inline-flex min-h-11 items-center rounded-xl border border-borda px-3 text-sm font-medium text-marca-forte hover:bg-fundo"
          >
            Renomear
          </button>
          <Link href={`/app/${slug}/grupos/${g.id}`} className="inline-flex min-h-11 items-center rounded-xl border border-borda px-3 text-sm font-medium text-marca-forte hover:bg-fundo">
            Editar e-mails
          </Link>
          <BotaoConfirmar
            acao={apagarGrupo.bind(null, slug, g.id)}
            pergunta={
              doMoodle
                ? `Apagar “${nome}”? Ela some daqui e o Moodle não traz de volta. As entregas antigas também somem das telas.`
                : `Apagar “${nome}”? As entregas dela também são apagadas. Isso não pode ser desfeito.`
            }
          >
            Apagar {palavra.toLowerCase()}
          </BotaoConfirmar>
        </div>
      ) : null}
    </li>
  );
}

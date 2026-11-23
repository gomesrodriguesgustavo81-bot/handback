import { AreaTexto, Campo } from "@/components/ui";
import type { Vocabulario } from "@/lib/frentes";

export type DadosGrupo = { nome: string; tema: string; observacoes: string; emails: string[]; ativo: boolean };

/** Campos do formulário de grupo (os mesmos para criar e editar). */
export function CamposGrupo({ v, inicial, editando = false }: { v: Vocabulario; inicial?: Partial<DadosGrupo>; editando?: boolean }) {
  // Na edição, as pessoas ficam numa lista própria (abaixo do formulário).
  return (
    <>
      <Campo rotulo="Nome" name="nome" required defaultValue={inicial?.nome} placeholder={`Ex.: ${v.grupo} Azul`} />
      <Campo rotulo="Tema ou projeto (opcional)" name="tema" defaultValue={inicial?.tema} />
      {editando ? null : <AreaTexto
        rotulo="E-mails de quem entrega"
        name="emails"
        rows={4}
        defaultValue={(inicial?.emails ?? []).join("\n")}
        placeholder={"Um por linha ou separados por vírgula. Ex.:\nana@email.com\nbruno@email.com"}
        dica="Qualquer um destes e-mails pode enviar a entrega, e todos recebem a devolutiva. Cada e-mail só pode estar em um cadastro."
      />}
      <AreaTexto rotulo="Observações (opcional)" name="observacoes" rows={2} defaultValue={inicial?.observacoes} />
      {editando ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={inicial?.ativo ?? true} className="h-5 w-5 accent-[var(--marca)]" />
          Ativo (desmarque para pausar sem apagar o histórico)
        </label>
      ) : null}
    </>
  );
}

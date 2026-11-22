import { Aviso } from "./ui";

/** Mostrado enquanto o Supabase não foi ligado (variáveis de ambiente vazias). */
export function SemConfiguracao() {
  return (
    <Aviso tipo="alerta">
      <strong>O banco de dados ainda não foi ligado.</strong> Para o login funcionar, crie o projeto no
      Supabase e preencha as variáveis descritas no arquivo <code>.env.example</code> (o passo a passo está em{" "}
      <code>docs/COMO_COLOCAR_NO_AR.md</code>).
    </Aviso>
  );
}

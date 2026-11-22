/** Coisas compartilhadas pelas rotas de conexão do Gmail. */
export const COOKIE_ESTADO = "hb_gmail_estado";

export function comAviso(caminho: string, aviso: string) {
  return `${caminho}${caminho.includes("?") ? "&" : "?"}gmail=${aviso}`;
}

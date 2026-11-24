/** Enquanto a página carrega: o formato dela em cinza brilhando (nada de tela branca). */
export default function Carregando() {
  return (
    <div role="status" aria-label="Carregando" className="flex max-w-2xl flex-col gap-3">
      <span className="esqueleto h-8 w-1/2 rounded-lg" />
      <span className="esqueleto h-4 w-3/4 rounded-md" />
      <span className="esqueleto mt-2 h-16 rounded-2xl" />
      <span className="esqueleto h-16 rounded-2xl" />
      <span className="esqueleto h-16 rounded-2xl" />
    </div>
  );
}

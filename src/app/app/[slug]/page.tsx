import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Aviso, Cartao, Selo } from "@/components/ui";
import { FRENTES, PAPEIS } from "@/lib/frentes";
import { empresaPorSlug } from "@/lib/sessao";

export async function generateMetadata({ params }: PageProps<"/app/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const empresa = await empresaPorSlug(slug);
  return { title: empresa?.nome ?? "Empresa" };
}

export default async function PainelEmpresa({ params }: PageProps<"/app/[slug]">) {
  const { slug } = await params;
  const empresa = await empresaPorSlug(slug);
  if (!empresa) notFound();

  const v = empresa.vocabulario;
  const proximos = [
    { titulo: v.etapas, texto: `Cadastro das ${v.etapas.toLowerCase()}, com prazos e checklist do que deve ser entregue.` },
    { titulo: v.grupos, texto: `Cadastro das ${v.grupos.toLowerCase()} e dos e-mails de quem entrega.` },
    { titulo: "Entregas", texto: "Recebimento por e-mail e pelo site, com triagem do que precisa ser confirmado." },
    { titulo: "Devolutivas", texto: `Análise com IA, revisão do ${v.avaliador.toLowerCase()} e envio.` },
  ];

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{empresa.nome}</h1>
          <Selo>{FRENTES[empresa.frente].curto}</Selo>
        </div>
        <p className="text-suave">
          Seu papel: {empresa.papel ? PAPEIS[empresa.papel] : "Dono da plataforma"}
        </p>
      </div>

      {!empresa.ativa ? (
        <Aviso tipo="alerta">Esta empresa está bloqueada. Fale com o suporte do Handback.</Aviso>
      ) : null}

      <Cartao>
        <h2 className="font-semibold">Palavras usadas nesta empresa</h2>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-suave">Etapa</dt>
            <dd className="font-medium">{v.etapa}</dd>
          </div>
          <div>
            <dt className="text-suave">Quem avalia</dt>
            <dd className="font-medium">{v.avaliador}</dd>
          </div>
          <div>
            <dt className="text-suave">Quem entrega</dt>
            <dd className="font-medium">{v.grupo}</dd>
          </div>
        </dl>
      </Cartao>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Em construção</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {proximos.map((p) => (
            <li key={p.titulo} className="rounded-2xl border border-dashed border-borda p-5">
              <p className="font-medium">{p.titulo}</p>
              <p className="mt-1 text-sm text-suave">{p.texto}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

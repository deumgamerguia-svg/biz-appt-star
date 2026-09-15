import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { useBusiness } from "@/lib/business";
import { categoryLabel } from "@/lib/format";
import { PageHeader, EmptyList } from "@/components/painel/PageHeader";

export const Route = createFileRoute("/_authenticated/painel/negocios")({
  head: () => ({
    meta: [
      { title: "Negócio — Agenda Agora" },
      { name: "description", content: "Informações do estabelecimento configurado pelo painel Master." },
    ],
  }),
  component: NegociosPage,
});

function NegociosPage() {
  const { businesses } = useBusiness();

  return (
    <div>
      <PageHeader
        title="Negócio"
        subtitle="As informações do estabelecimento são configuradas exclusivamente pelo painel Master."
      />

      {businesses.length === 0 ? (
        <EmptyList text="Seu acesso ainda não foi vinculado a um estabelecimento pelo painel Master." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {businesses.map((b) => (
            <article key={b.id} className="surface p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Store className="size-5" />
                </span>
                <div>
                  <h2 className="font-bold">{b.name}</h2>
                  <p className="text-xs text-muted-foreground">{categoryLabel(b.category)}</p>
                </div>
              </div>
              <dl className="mt-5 space-y-2 text-sm text-muted-foreground">
                {b.phone && <dd>{b.phone}</dd>}
                {b.address && <dd>{b.address}</dd>}
                <dd className="text-xs">Link público: /{b.slug}</dd>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

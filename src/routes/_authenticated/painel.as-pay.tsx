import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatPrice, formatTime } from "@/lib/format";
import { PageHeader, NoBusiness, EmptyList } from "@/components/painel/PageHeader";

export const Route = createFileRoute("/_authenticated/painel/as-pay")({
  head: () => ({
    meta: [
      { title: "AS Pay — Agenda Agora�" },
      { name: "description", content: "Saldo dos sinais pagos pelos clientes para agendar." },
      { property: "og:title", content: "AS Pay — Agenda Agora�" },
      { property: "og:description", content: "Saldo dos sinais pagos pelos clientes." },
    ],
  }),
  component: AsPayPage,
});

function AsPayPage() {
  const { businessId, business } = useBusiness();

  const { data: rows } = useQuery({
    queryKey: ["as-pay", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, customer_name, starts_at, deposit_cents, deposit_paid_at, status")
        .eq("business_id", businessId!)
        .gt("deposit_cents", 0)
        .order("starts_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  if (!businessId) return <NoBusiness />;

  const list = rows ?? [];
  const available = list
    .filter((r) => r.deposit_paid_at && r.status !== "cancelado")
    .reduce((sum, r) => sum + r.deposit_cents, 0);
  const pending = list
    .filter((r) => !r.deposit_paid_at && r.status !== "cancelado")
    .reduce((sum, r) => sum + r.deposit_cents, 0);

  return (
    <div>
      <PageHeader
        title="Sua carteira"
        subtitle={`Sinais pagos pelos clientes de ${business?.name ?? "seu negócio"}.`}
      />

      <div className="mx-auto max-w-2xl rounded-2xl border-2 border-primary/70 bg-card p-6 shadow-[0_0_24px_-8px_hsl(var(--primary))]">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Saldo disponível</p>
        <p className="font-display text-3xl font-bold text-primary">{formatPrice(available)}</p>
        <p className="mt-4 text-xs font-semibold uppercase text-muted-foreground">Saldo pendente</p>
        <p className="font-display text-3xl font-bold">{formatPrice(pending)}</p>
      </div>

      <p className="mx-auto mt-5 max-w-2xl text-center text-sm text-muted-foreground">
        Todas as transações de sinal são intermediadas pelo Agenda Agora�.
      </p>

      <h2 className="mt-8 mb-3 text-lg font-bold">Últimos sinais</h2>
      {!list.length ? (
        <EmptyList text="Nenhum sinal recebido ainda." />
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className="surface flex flex-wrap items-center gap-4 p-4">
              <div className="flex-1">
                <p className="font-semibold">{r.customer_name}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(r.starts_at).toLocaleDateString("pt-BR")} · {formatTime(r.starts_at)}
                </p>
              </div>
              <span className="font-semibold">{formatPrice(r.deposit_cents)}</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  r.deposit_paid_at
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {r.deposit_paid_at ? "Pago" : "Pendente"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

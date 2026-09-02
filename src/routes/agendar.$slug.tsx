import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/agendar/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Agendar horário — ${params.slug}` },
      {
        name: "description",
        content: "Escolha o serviço e marque seu horário online, em poucos toques.",
      },
      { property: "og:title", content: "Agende seu horário" },
      {
        property: "og:description",
        content: "Escolha o serviço e marque seu horário online, em poucos toques.",
      },
    ],
  }),
  component: PublicBooking,
});

function PublicBooking() {
  const { slug } = Route.useParams();
  const [tab, setTab] = useState<"agendar" | "historico">("agendar");

  const { data: business, isLoading } = useQuery({
    queryKey: ["public-business", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, category, phone, address")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: services } = useQuery({
    queryKey: ["public-services", business?.id],
    enabled: !!business?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, price_cents")
        .eq("business_id", business!.id)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <header className="bg-sidebar px-4 py-3">
        <span className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-primary">
          Agenda Serviço
        </span>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4">
        <div className="py-8 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-wide">
            {isLoading ? "Carregando..." : (business?.name ?? "Negócio não encontrado")}
          </h1>
          {business?.address && (
            <p className="mt-1 text-xs text-muted-foreground">{business.address}</p>
          )}
        </div>

        {tab === "agendar" ? (
          <div className="space-y-4">
            {(services ?? []).map((s) => (
              <button
                key={s.id}
                type="button"
                className="w-full rounded-md border border-border px-4 py-6 text-center transition-colors hover:border-primary"
              >
                <p className="text-lg">{s.name}</p>
                <p className="mt-4 text-sm text-muted-foreground">
                  {s.duration_minutes}min
                  {s.price_cents > 0 ? ` · ${formatPrice(s.price_cents)}` : ""}
                </p>
              </button>
            ))}
            {business && !services?.length && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhum serviço disponível no momento.
              </p>
            )}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Seus agendamentos aparecerão aqui.
          </p>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-4 mx-auto flex w-[min(28rem,90%)] items-center justify-around rounded-full border border-border bg-card py-3 shadow-lg">
        {(
          [
            { key: "agendar", label: "Agendar", icon: CalendarDays },
            { key: "historico", label: "Histórico", icon: Clock },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`flex flex-col items-center gap-1 text-xs ${
              tab === item.key
                ? "font-semibold text-foreground underline underline-offset-4"
                : "text-muted-foreground"
            }`}
          >
            <item.icon className="size-4" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

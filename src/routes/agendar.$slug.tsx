import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Clock, Copy, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, toDateInput } from "@/lib/format";
import { getAvailability, createDepositBooking, getDepositStatus } from "@/lib/booking.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/agendar/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Agendar horário — ${params.slug}` },
      {
        name: "description",
        content: "Escolha o serviço, pague o sinal por Pix e confirme seu horário na hora.",
      },
      { property: "og:title", content: "Agende seu horário" },
      {
        property: "og:description",
        content: "Escolha o serviço, pague o sinal por Pix e confirme seu horário na hora.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PublicBooking,
});

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  deposit_cents: number;
  description: string | null;
};

type Charge = {
  chargeId: string;
  amountCents: number;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
};

function PublicBooking() {
  const { slug } = Route.useParams();
  const [tab, setTab] = useState<"agendar" | "historico">("agendar");
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [charge, setCharge] = useState<Charge | null>(null);
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState(false);

  const availabilityFn = useServerFn(getAvailability);
  const bookFn = useServerFn(createDepositBooking);
  const statusFn = useServerFn(getDepositStatus);

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
        .select("id, name, duration_minutes, price_cents, deposit_cents, description")
        .eq("business_id", business!.id)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data as Service[];
    },
  });

  const { data: availability, isFetching: loadingSlots } = useQuery({
    queryKey: ["public-slots", slug, service?.id, date],
    enabled: !!service && !charge,
    queryFn: () => availabilityFn({ data: { slug, serviceId: service!.id, date } }),
  });

  const book = useMutation({
    mutationFn: () =>
      bookFn({
        data: {
          slug,
          serviceId: service!.id,
          date,
          time: time!,
          customerName: name.trim(),
          customerPhone: phone.trim(),
        },
      }),
    onSuccess: (c) => setCharge(c),
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!charge || paid) return;
    const id = setInterval(async () => {
      try {
        const r = await statusFn({ data: { chargeId: charge.chargeId } });
        if (r.status === "pago") setPaid(true);
        if (r.status === "expirado") {
          toast.error("O prazo do Pix acabou. Escolha o horário novamente.");
          setCharge(null);
          setTime(null);
        }
      } catch {
        /* tenta de novo no próximo ciclo */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [charge, paid, statusFn]);

  const reset = () => {
    setCharge(null);
    setPaid(false);
    setService(null);
    setTime(null);
    setName("");
    setPhone("");
  };

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

        {tab === "historico" ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Seus agendamentos aparecerão aqui.
          </p>
        ) : paid ? (
          <div className="rounded-2xl border-2 border-primary/70 bg-card p-6 text-center">
            <Check className="mx-auto size-10 text-primary" />
            <h2 className="mt-3 font-display text-xl font-bold">Agendamento confirmado!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Sinal recebido. Te esperamos em{" "}
              {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")} às {time}.
            </p>
            <Button className="mt-5" onClick={reset}>
              Fazer outro agendamento
            </Button>
          </div>
        ) : charge ? (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <h2 className="font-display text-lg font-bold">Pague o sinal para confirmar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatPrice(charge.amountCents)} via Pix · o horário só fica reservado após o
              pagamento.
            </p>
            {charge.qrCodeBase64 && (
              <img
                src={`data:image/png;base64,${charge.qrCodeBase64}`}
                alt="QR Code do Pix para pagar o sinal"
                className="mx-auto mt-5 size-56 rounded-md bg-white p-2"
              />
            )}
            {charge.qrCode && (
              <div className="mt-5">
                <p className="break-all rounded-md bg-muted p-3 text-left text-xs">
                  {charge.qrCode}
                </p>
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    void navigator.clipboard.writeText(charge.qrCode!);
                    setCopied(true);
                    toast.success("Código Pix copiado!");
                  }}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copiar
                  código Pix
                </Button>
              </div>
            )}
            <p className="mt-5 text-xs text-muted-foreground">
              Aguardando o pagamento... a confirmação é automática.
            </p>
          </div>
        ) : !service ? (
          <div className="space-y-4">
            {(services ?? []).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setService(s)}
                className="w-full rounded-md border border-border px-4 py-6 text-center transition-colors hover:border-primary"
              >
                <p className="text-lg">{s.name}</p>
                {s.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                )}
                <p className="mt-4 text-sm text-muted-foreground">
                  {s.duration_minutes}min
                  {s.price_cents > 0 ? ` · ${formatPrice(s.price_cents)}` : ""}
                </p>
                {s.deposit_cents > 0 && (
                  <p className="mt-1 text-xs font-semibold text-primary">
                    Sinal de {formatPrice(s.deposit_cents)} para confirmar
                  </p>
                )}
              </button>
            ))}
            {business && !services?.length && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhum serviço disponível no momento.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => {
                setService(null);
                setTime(null);
              }}
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <ArrowLeft className="size-4" /> {service.name}
            </button>

            <div className="space-y-2">
              <Label htmlFor="data">Escolha o dia</Label>
              <Input
                id="data"
                type="date"
                value={date}
                min={toDateInput(new Date())}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime(null);
                }}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Horários livres</p>
              {loadingSlots ? (
                <p className="text-sm text-muted-foreground">Carregando horários...</p>
              ) : !availability?.slots.length ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum horário livre nesse dia. Tente outra data.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {availability.slots.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTime(s)}
                      className={`rounded-md border px-2 py-2 text-sm transition-colors ${
                        time === s
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border hover:border-primary"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {time && (
              <div className="space-y-4 rounded-md border border-border p-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Seu nome</Label>
                  <Input id="nome" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fone">Seu WhatsApp</Label>
                  <Input
                    id="fone"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Sinal de {formatPrice(service.deposit_cents)} por Pix. O agendamento só é
                  confirmado depois do pagamento.
                </p>
                <Button
                  className="w-full"
                  disabled={name.trim().length < 2 || phone.trim().length < 8 || book.isPending}
                  onClick={() => book.mutate()}
                >
                  Pagar sinal e agendar
                </Button>
              </div>
            )}
          </div>
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

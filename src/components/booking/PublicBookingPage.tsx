import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  DollarSign,
  History,
  Info,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/lib/format";
import {
  cancelDepositBooking,
  generateDepositPix,
  getAvailability,
  getDepositStatus,
  getMyBookings,
  getOpenDays,
} from "@/lib/booking.functions";
import {
  getPublicBookingPage,
  getPublicServiceProfessionals,
  reservePublicBooking,
} from "@/lib/public-booking.functions";
import { cancelCustomerBooking } from "@/lib/cancellation.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  deposit_cents: number;
  description: string | null;
  show_price: boolean;
  show_duration: boolean;
  is_combo: boolean;
  image_url: string | null;
};

type Professional = {
  id: string;
  name: string;
  role: string | null;
};

type CancellationPreferences = {
  cancellations_enabled?: boolean;
  cancellation_notice_minutes?: number;
  cancellations?: boolean;
};

type Booking = {
  chargeId: string;
  chargeStatus: string;
  amountCents: number;
  customerName: string | null;
  expiresAt: string | null;
  createdAt: string;
  startsAt: string | null;
  appointmentStatus: string;
  serviceName: string;
  professionalName: string;
};

const DAY_LABEL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function ddmm(date: string) {
  const [, month, day] = date.split("-");
  return `${day}/${month}`;
}

function fullDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function storageKey(slug: string) {
  return `agenda-servico:${slug}:charges`;
}

function readCharges(slug: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function PublicBookingPage({ slug }: { slug: string }) {
  const [tab, setTab] = useState<"agendar" | "historico">("agendar");
  const [service, setService] = useState<Service | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pageStart, setPageStart] = useState(0);
  const [charges, setCharges] = useState<string[]>([]);
  const [activeCharge, setActiveCharge] = useState<string | null>(null);

  const pageFn = useServerFn(getPublicBookingPage);
  const professionalsFn = useServerFn(getPublicServiceProfessionals);
  const availabilityFn = useServerFn(getAvailability);
  const openDaysFn = useServerFn(getOpenDays);
  const reserveFn = useServerFn(reservePublicBooking);
  const bookingsFn = useServerFn(getMyBookings);

  useEffect(() => {
    setCharges(readCharges(slug));
  }, [slug]);

  const saveCharge = useCallback(
    (id: string) => {
      const next = [id, ...readCharges(slug).filter((chargeId) => chargeId !== id)].slice(0, 30);
      window.localStorage.setItem(storageKey(slug), JSON.stringify(next));
      setCharges(next);
    },
    [slug],
  );

  const pageQuery = useQuery({
    queryKey: ["public-booking-page", slug],
    queryFn: () => pageFn({ data: { slug } }),
    retry: 1,
  });

  const business = pageQuery.data?.business ?? null;
  const services = (pageQuery.data?.services ?? []) as Service[];
  const hiddenServices = pageQuery.data?.hiddenServices ?? 0;
  const normalServices = services.filter((item) => !item.is_combo);
  const combos = services.filter((item) => item.is_combo);

  const professionalsQuery = useQuery({
    queryKey: ["public-service-professionals", slug, service?.id],
    enabled: !!service,
    queryFn: () => professionalsFn({ data: { slug, serviceId: service!.id } }),
    retry: 1,
  });
  const professionals = (professionalsQuery.data?.professionals ?? []) as Professional[];

  const openDaysQuery = useQuery({
    queryKey: ["public-days", slug],
    enabled: !!business && business.status !== "suspenso",
    queryFn: () => openDaysFn({ data: { slug } }),
    retry: 1,
  });
  const days = openDaysQuery.data?.days ?? [];
  const visibleDays = useMemo(() => days.slice(pageStart, pageStart + 7), [days, pageStart]);

  const availabilityQuery = useQuery({
    queryKey: ["public-slots", slug, service?.id, professional?.id, date],
    enabled:
      !!service &&
      !!date &&
      professionalsQuery.isSuccess &&
      (professionals.length === 0 || !!professional),
    queryFn: () =>
      availabilityFn({
        data: {
          slug,
          serviceId: service!.id,
          date: date!,
          professionalId: professional?.id ?? null,
        },
      }),
    retry: 1,
  });

  const bookingsQuery = useQuery({
    queryKey: ["public-bookings", slug, charges.join(",")],
    enabled: charges.length > 0,
    refetchInterval: 8000,
    queryFn: () => bookingsFn({ data: { chargeIds: charges } }),
  });

  const reserve = useMutation({
    mutationFn: () =>
      reserveFn({
        data: {
          slug,
          serviceId: service!.id,
          date: date!,
          time: time!,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          professionalId: professional?.id ?? null,
        },
      }),
    onSuccess: (result) => {
      saveCharge(result.chargeId);
      setService(null);
      setProfessional(null);
      setDate(null);
      setTime(null);
      setPageStart(0);
      setTab("historico");
      if (result.paymentRequired) {
        setActiveCharge(result.chargeId);
      } else {
        setActiveCharge(null);
        toast.success("Agendamento confirmado!");
      }
      void bookingsQuery.refetch();
    },
    onError: (error: Error) => {
      setFormError(error.message);
      toast.error(error.message);
    },
  });

  const submit = () => {
    if (!service || !date || !time) return;
    if (name.trim().length < 2) {
      setFormError("Informe o seu nome e sobrenome.");
      return;
    }
    if (phone.replace(/\D/g, "").length < 8) {
      setFormError("Informe um telefone válido.");
      return;
    }
    setFormError(null);
    reserve.mutate();
  };

  const openService = (selected: Service) => {
    setService(selected);
    setProfessional(null);
    setDate(null);
    setTime(null);
    setPageStart(0);
    setFormError(null);
  };

  const closeService = () => {
    setService(null);
    setProfessional(null);
    setDate(null);
    setTime(null);
    setPageStart(0);
    setFormError(null);
  };

  const cancellationPreferences =
    (business?.booking_preferences ?? {}) as CancellationPreferences;
  const cancellationEnabled =
    cancellationPreferences.cancellations_enabled ?? cancellationPreferences.cancellations ?? true;
  const cancellationNoticeMinutes = Math.max(
    0,
    Math.min(1440, Number(cancellationPreferences.cancellation_notice_minutes ?? 0) || 0),
  );

  return (
    <div
      data-booking-page="true"
      className="flex min-h-screen flex-col bg-background pb-28 text-foreground"
      style={
        {
          ...(business?.brand_primary ? { "--primary": business.brand_primary } : {}),
          ...(business?.brand_background ? { "--background": business.brand_background } : {}),
        } as React.CSSProperties
      }
    >
      <header className="border-b border-border/40 bg-sidebar px-4 py-3">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between">
          <span className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-primary">
            Agenda Agora
          </span>
          {business?.phone ? (
            <a
              href={`tel:${business.phone}`}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Phone className="size-3.5" /> Contato
            </a>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-8">
        {pageQuery.isLoading ? (
          <LoadingState />
        ) : pageQuery.isError ? (
          <ErrorState
            message={
              pageQuery.error instanceof Error
                ? pageQuery.error.message
                : "Não foi possível carregar a agenda."
            }
            onRetry={() => void pageQuery.refetch()}
          />
        ) : !business ? (
          <ErrorState message="Este link de agendamento não foi encontrado." />
        ) : (
          <>
            <BusinessHeader
              name={business.name}
              logoUrl={business.logo_url}
              address={business.address}
            />

            {business.status === "suspenso" ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-center text-sm text-destructive">
                Os agendamentos deste estabelecimento estão temporariamente indisponíveis.
              </div>
            ) : tab === "agendar" ? (
              <div className="space-y-8">
                {services.length ? (
                  <>
                    {normalServices.length > 0 && (
                      <ServiceSection
                        title="Serviços"
                        services={normalServices}
                        onSelect={openService}
                      />
                    )}
                    {combos.length > 0 && (
                      <ServiceSection title="Combos" services={combos} onSelect={openService} />
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-8 text-center">
                    <p className="font-semibold">Nenhum serviço disponível no momento.</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Volte mais tarde para conferir novos horários e serviços.
                    </p>
                  </div>
                )}

                {hiddenServices > 0 && services.length > 0 ? (
                  <p className="text-center text-xs text-muted-foreground">
                    Alguns serviços estão temporariamente indisponíveis para agendamento online.
                  </p>
                ) : null}
              </div>
            ) : (
              <HistoryList
                bookings={(bookingsQuery.data?.bookings ?? []) as Booking[]}
                onOpen={setActiveCharge}
                onRefresh={() => void bookingsQuery.refetch()}
                cancellationEnabled={cancellationEnabled}
                cancellationNoticeMinutes={cancellationNoticeMinutes}
              />
            )}
          </>
        )}
      </main>

      <Dialog open={!!service} onOpenChange={(open) => !open && closeService()}>
        <DialogContent data-booking-modal="true" className="max-h-[92vh] max-w-lg overflow-y-auto bg-card p-0">
          {service ? (
            <div className="space-y-6 p-5 text-center sm:p-6">
              <div>
                {service.image_url ? (
                  <img
                    src={service.image_url}
                    alt={service.name}
                    className="mx-auto mb-5 max-h-52 w-full rounded-lg object-cover"
                  />
                ) : null}
                <h2 className="font-display text-xl font-bold">{service.name}</h2>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  {service.show_price ? <span>{formatPrice(service.price_cents)}</span> : null}
                  {service.show_price && service.show_duration ? <span>·</span> : null}
                  {service.show_duration ? <span>{service.duration_minutes}min</span> : null}
                </div>
                {service.description ? (
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                ) : null}
              </div>

              {professionalsQuery.isLoading ? (
                <InlineLoading label="Carregando profissionais..." />
              ) : professionalsQuery.isError ? (
                <InlineError
                  message="Não foi possível carregar os profissionais deste serviço."
                  onRetry={() => void professionalsQuery.refetch()}
                />
              ) : professionals.length > 0 ? (
                <div>
                  <p className="mb-3 text-sm font-semibold">Escolha o profissional</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {professionals.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        data-booking-agenda-option="true"
                        data-active={professional?.id === item.id ? "true" : "false"}
                        onClick={() => {
                          setProfessional(item);
                          setDate(null);
                          setTime(null);
                          setPageStart(0);
                        }}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          professional?.id === item.id
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border bg-background/30 hover:border-primary"
                        }`}
                      >
                        <span className="block font-semibold">{item.name}</span>
                        {item.role ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {item.role}
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {professionalsQuery.isSuccess &&
              (professionals.length === 0 || professional) ? (
                <div>
                  <p className="mb-3 text-sm font-semibold">Escolha a data</p>
                  {openDaysQuery.isLoading ? (
                    <InlineLoading label="Carregando datas..." />
                  ) : openDaysQuery.isError ? (
                    <InlineError
                      message="Não foi possível carregar os dias de atendimento."
                      onRetry={() => void openDaysQuery.refetch()}
                    />
                  ) : !days.length ? (
                    <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                      Nenhum dia de atendimento está disponível no momento.
                    </p>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Datas anteriores"
                        disabled={pageStart === 0}
                        onClick={() => setPageStart(Math.max(0, pageStart - 7))}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronLeft className="size-6" />
                      </button>
                      <div className="flex flex-1 flex-wrap justify-center gap-2">
                        {visibleDays.map((item) => (
                          <button
                            key={item.date}
                            type="button"
                            data-booking-agenda-option="true"
                            data-active={date === item.date ? "true" : "false"}
                            onClick={() => {
                              setDate(item.date);
                              setTime(null);
                            }}
                            className={`min-w-[4.75rem] rounded-lg border px-3 py-2 text-sm transition-colors ${
                              date === item.date
                                ? "border-primary bg-primary/15 text-primary"
                                : "border-border bg-background/30 hover:border-primary"
                            }`}
                          >
                            <span className="block font-semibold">{ddmm(item.date)}</span>
                            <span className="mt-0.5 block text-[11px] opacity-80">
                              {DAY_LABEL[item.weekday]}
                            </span>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        aria-label="Próximas datas"
                        disabled={pageStart + 7 >= days.length}
                        onClick={() => setPageStart(pageStart + 7)}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                      >
                        <ChevronRight className="size-6" />
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {date ? (
                <div>
                  <p className="mb-3 text-sm font-semibold">Escolha um horário disponível</p>
                  {availabilityQuery.isFetching ? (
                    <InlineLoading label="Carregando horários..." />
                  ) : availabilityQuery.isError ? (
                    <InlineError
                      message={
                        availabilityQuery.error instanceof Error
                          ? availabilityQuery.error.message
                          : "Não foi possível carregar os horários."
                      }
                      onRetry={() => void availabilityQuery.refetch()}
                    />
                  ) : !availabilityQuery.data?.slots.length ? (
                    <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                      Nenhum horário livre nesta data. Escolha outro dia.
                    </p>
                  ) : (
                    <div className="flex flex-wrap justify-center gap-2">
                      {availabilityQuery.data.slots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          data-booking-agenda-option="true"
                          data-active={time === slot ? "true" : "false"}
                          onClick={() => setTime(slot)}
                          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                            time === slot
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-background/30 hover:border-primary"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {date && time ? (
                <div className="space-y-4 border-t border-border pt-5">
                  <div>
                    <h3 className="font-display text-base font-bold uppercase tracking-wide">Resumo</h3>
                    <div className="mx-auto mt-3 max-w-sm space-y-2 rounded-lg border border-border bg-background/30 p-4 text-left text-sm">
                      <p className="flex items-center gap-2">
                        <Info className="size-4 shrink-0 text-primary" /> {service.name}
                      </p>
                      <p className="flex items-center gap-2">
                        <User className="size-4 shrink-0 text-primary" />
                        {professional?.name ?? "Profissional disponível"}
                      </p>
                      <p className="flex items-center gap-2">
                        <CalendarDays className="size-4 shrink-0 text-primary" /> {fullDate(date)}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock className="size-4 shrink-0 text-primary" /> {time}
                      </p>
                    </div>
                  </div>

                  {formError ? (
                    <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {formError}
                    </p>
                  ) : null}

                  <div className="grid gap-3 text-left sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="booking-name">Nome e sobrenome</Label>
                      <Input
                        id="booking-name"
                        autoComplete="name"
                        placeholder="Nome e sobrenome"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="booking-phone">Telefone</Label>
                      <Input
                        id="booking-phone"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(11) 99999-9999"
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                      />
                    </div>
                  </div>

                  <Button className="w-full" disabled={reserve.isPending} onClick={submit}>
                    {reserve.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Confirmando...
                      </>
                    ) : (
                      "Agendar"
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    {service.deposit_cents > 0
                      ? `Para confirmar, será necessário pagar um sinal de ${formatPrice(service.deposit_cents)} por Pix.`
                      : "Este serviço não exige pagamento de sinal. O horário será confirmado ao finalizar."}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {activeCharge ? (
        <PaymentDialog
          chargeId={activeCharge}
          booking={
            ((bookingsQuery.data?.bookings ?? []) as Booking[]).find(
              (booking) => booking.chargeId === activeCharge,
            ) ?? null
          }
          onClose={() => {
            setActiveCharge(null);
            void bookingsQuery.refetch();
          }}
        />
      ) : null}

      <nav className="fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[min(28rem,90%)] items-center justify-around rounded-full border border-border bg-card/95 py-3 shadow-lg backdrop-blur">
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
            className={`flex min-w-24 flex-col items-center gap-1 text-xs transition-colors ${
              tab === item.key
                ? "font-semibold text-foreground underline underline-offset-4"
                : "text-muted-foreground hover:text-foreground"
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

function BusinessHeader({
  name,
  logoUrl,
  address,
}: {
  name: string;
  logoUrl: string | null;
  address: string | null;
}) {
  return (
    <div className="py-8 text-center">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`Logotipo de ${name}`}
          className="mx-auto max-h-24 max-w-[72%] object-contain"
        />
      ) : (
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-border bg-card text-xl font-bold text-primary">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <h1 className="mt-4 text-xl font-semibold">{name}</h1>
      {address ? (
        <p className="mx-auto mt-2 flex max-w-md items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" /> {address}
        </p>
      ) : null}
    </div>
  );
}

function ServiceSection({
  title,
  services,
  onSelect,
}: {
  title: string;
  services: Service[];
  onSelect: (service: Service) => void;
}) {
  return (
    <section>
      <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-3">
        {services.map((service) => (
          <button
            key={service.id}
            type="button"
            data-booking-service-card="true"
            onClick={() => onSelect(service)}
            className="w-full rounded-lg border border-border bg-card px-4 py-5 text-center text-card-foreground transition-colors hover:border-primary"
          >
            <p className="text-base font-medium">{service.name}</p>
            {(service.show_price || service.show_duration) && (
              <p className="mt-2 text-sm text-muted-foreground">
                {service.show_price ? formatPrice(service.price_cents) : null}
                {service.show_price && service.show_duration ? " - " : null}
                {service.show_duration ? `${service.duration_minutes}min` : null}
              </p>
            )}
            {service.description ? (
              <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
                {service.description.length > 120
                  ? `${service.description.slice(0, 117)}...`
                  : service.description}
              </p>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="size-7 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Carregando serviços...</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center py-10">
      <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-6 text-center">
        <AlertCircle className="mx-auto size-7 text-destructive" />
        <p className="mt-3 text-sm">{message}</p>
        {onRetry ? (
          <Button variant="outline" className="mt-4" onClick={onRetry}>
            <RefreshCw className="size-4" /> Tentar novamente
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function InlineLoading({ label }: { label: string }) {
  return (
    <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </p>
  );
}

function InlineError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <p>{message}</p>
      <button type="button" className="mt-2 text-primary underline" onClick={onRetry}>
        Tentar novamente
      </button>
    </div>
  );
}

function statusInfo(booking: Booking) {
  if (booking.appointmentStatus === "cancelado") {
    return {
      tag: "#Agendamento Cancelado",
      tone: "border-destructive/60",
      label: "Cancelado",
    };
  }
  if (booking.chargeStatus === "pago") {
    return {
      tag: "#Agendamento Confirmado",
      tone: "border-primary/60",
      label: "Confirmado",
    };
  }
  return {
    tag: "#Agendamento Pendente",
    tone: "border-primary/40",
    label: "Aguardando pagamento",
  };
}

function HistoryList({
  bookings,
  onOpen,
  onRefresh,
  cancellationEnabled,
  cancellationNoticeMinutes,
}: {
  bookings: Booking[];
  onOpen: (id: string) => void;
  onRefresh: () => void;
  cancellationEnabled: boolean;
  cancellationNoticeMinutes: number;
}) {
  const cancelConfirmedFn = useServerFn(cancelCustomerBooking);
  const [pendingCancel, setPendingCancel] = useState<Booking | null>(null);

  const cancelConfirmed = useMutation({
    mutationFn: (chargeId: string) => cancelConfirmedFn({ data: { chargeId } }),
    onSuccess: () => {
      toast.success("Agendamento cancelado.");
      setPendingCancel(null);
      onRefresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!bookings.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <History className="mx-auto size-7 text-muted-foreground" />
        <p className="mt-3 font-semibold">Nenhum agendamento por aqui ainda.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Seus agendamentos feitos neste aparelho aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-3">
        <p className="text-sm font-semibold text-primary">Histórico de agendamentos</p>
        {bookings[0]?.customerName ? (
          <p className="text-sm text-muted-foreground">{bookings[0].customerName}</p>
        ) : null}
      </div>

      {bookings.map((booking) => {
        const info = statusInfo(booking);
        const starts = booking.startsAt ? new Date(booking.startsAt) : null;
        const cancellationDeadline = starts
          ? starts.getTime() - cancellationNoticeMinutes * 60_000
          : 0;
        const canCancel =
          cancellationEnabled &&
          booking.chargeStatus === "pago" &&
          booking.appointmentStatus !== "cancelado" &&
          !!starts &&
          starts.getTime() > Date.now() &&
          Date.now() <= cancellationDeadline;
        const paymentRequired = booking.amountCents > 0;

        return (
          <article key={booking.chargeId} className={`rounded-xl border ${info.tone} bg-card p-4`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold italic text-muted-foreground">{info.tag}</p>
              <span className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide">
                {info.label}
              </span>
            </div>

            <div className="mt-3 space-y-2 rounded-lg border border-border bg-background/20 p-3 text-sm">
              <p className="flex items-center gap-2">
                <Info className="size-4 text-primary" /> {booking.serviceName}
              </p>
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" />
                {starts
                  ? starts.toLocaleString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "America/Sao_Paulo",
                    })
                  : "—"}
              </p>
              <p className="flex items-center gap-2">
                <User className="size-4 text-primary" /> {booking.professionalName}
              </p>
            </div>

            <div className="mt-4 flex items-start justify-center gap-4">
              <Step icon={<History className="size-4" />} label="Agendamento cadastrado" />
              {paymentRequired ? (
                <Step icon={<DollarSign className="size-4" />} label="Pagamento do sinal" />
              ) : null}
              <Step
                icon={
                  booking.appointmentStatus === "cancelado" ? (
                    <X className="size-4" />
                  ) : booking.chargeStatus === "pago" ? (
                    <Check className="size-4" />
                  ) : (
                    <Clock className="size-4" />
                  )
                }
                label={info.label}
              />
            </div>

            {booking.chargeStatus === "pendente" &&
            booking.appointmentStatus !== "cancelado" &&
            paymentRequired ? (
              <Button
                className="mt-4 w-full"
                onClick={() => {
                  onOpen(booking.chargeId);
                  onRefresh();
                }}
              >
                Pagar sinal de {formatPrice(booking.amountCents)}
              </Button>
            ) : null}

            {canCancel ? (
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => setPendingCancel(booking)}
              >
                Cancelar agendamento
              </Button>
            ) : null}
          </article>
        );
      })}

      <Dialog open={!!pendingCancel} onOpenChange={(open) => !open && setPendingCancel(null)}>
        <DialogContent className="max-w-sm text-center">
          <h3 className="text-lg font-semibold">Cancelar agendamento?</h3>
          <p className="text-sm text-muted-foreground">
            Ao confirmar, o horário ficará disponível novamente para outros clientes.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setPendingCancel(null)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={cancelConfirmed.isPending}
              onClick={() => pendingCancel && cancelConfirmed.mutate(pendingCancel.chargeId)}
            >
              {cancelConfirmed.isPending ? "Cancelando..." : "Confirmar cancelamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Step({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex w-24 flex-col items-center gap-1 text-center">
      <span className="flex size-9 items-center justify-center rounded-full border border-primary/70 text-primary">
        {icon}
      </span>
      <span className="text-[10px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}

function PaymentDialog({
  chargeId,
  booking,
  onClose,
}: {
  chargeId: string;
  booking: Booking | null;
  onClose: () => void;
}) {
  const pixFn = useServerFn(generateDepositPix);
  const statusFn = useServerFn(getDepositStatus);
  const cancelFn = useServerFn(cancelDepositBooking);
  const [pix, setPix] = useState<{
    qrCode: string | null;
    qrCodeBase64: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [paid, setPaid] = useState(false);
  const [left, setLeft] = useState(300);

  const expiresAt = booking?.expiresAt ? new Date(booking.expiresAt).getTime() : null;

  useEffect(() => {
    const tick = () => {
      if (!expiresAt) return;
      setLeft(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (paid) return;
    const id = window.setInterval(async () => {
      try {
        const result = await statusFn({ data: { chargeId } });
        if (result.status === "pago") setPaid(true);
        if (result.status === "expirado") {
          toast.error("O prazo do Pix acabou e o agendamento foi cancelado.");
          onClose();
        }
      } catch {
        // A próxima consulta tenta novamente.
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [chargeId, paid, statusFn, onClose]);

  const generate = useMutation({
    mutationFn: () => pixFn({ data: { chargeId } }),
    onSuccess: (result) =>
      setPix({ qrCode: result.qrCode, qrCodeBase64: result.qrCodeBase64 }),
    onError: (error: Error) => toast.error(error.message),
  });

  const cancel = useMutation({
    mutationFn: () => cancelFn({ data: { chargeId } }),
    onSuccess: () => {
      toast.success("Agendamento cancelado.");
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const minutes = String(Math.floor(left / 60)).padStart(2, "0");
  const seconds = String(left % 60).padStart(2, "0");

  if (paid) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md text-center">
          <Check className="mx-auto size-10 text-primary" />
          <h2 className="font-display text-xl font-bold">Agendamento confirmado!</h2>
          <p className="text-sm text-muted-foreground">
            Pagamento recebido. Seu horário está reservado.
          </p>
          <Button onClick={onClose}>Fechar</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto text-center">
        <h2 className="font-display text-xl font-bold">Agendamento aguardando pagamento</h2>
        <p className="text-sm text-muted-foreground">
          Para confirmar seu horário, efetue o pagamento do sinal via Pix.
        </p>
        <p className="mx-auto w-fit rounded-md bg-muted px-4 py-1 text-sm font-semibold">
          {formatPrice(booking?.amountCents ?? 0)}
        </p>
        <Button
          className="mx-auto w-fit"
          disabled={generate.isPending || !!pix}
          onClick={() => generate.mutate()}
        >
          {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Gerar código Pix
        </Button>

        {pix?.qrCodeBase64 ? (
          <img
            src={`data:image/png;base64,${pix.qrCodeBase64}`}
            alt="QR Code Pix para pagamento do sinal"
            className="mx-auto size-56 rounded-lg bg-white p-2"
          />
        ) : null}

        {pix?.qrCode ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Use a função Pix copia e cola do seu banco para concluir o pagamento.
            </p>
            <p className="truncate rounded-md bg-muted px-3 py-2 text-left text-xs">
              {pix.qrCode}
            </p>
            <Button
              variant="secondary"
              className="mx-auto w-fit"
              onClick={() => {
                void navigator.clipboard.writeText(pix.qrCode!);
                setCopied(true);
                toast.success("Código Pix copiado!");
              }}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copiar código Pix
            </Button>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          O pagamento deve ser concluído antes que o prazo da reserva termine.
        </p>
        <p className="font-display text-lg font-bold">
          Tempo restante: {minutes}:{seconds}
        </p>
        <Button variant="outline" className="mx-auto w-fit" onClick={() => setConfirmCancel(true)}>
          Cancelar pagamento
        </Button>

        <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <DialogContent className="max-w-sm text-center">
            <h3 className="text-base font-semibold">Cancelar esta reserva?</h3>
            <p className="text-sm">O horário será liberado novamente.</p>
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                Sim, cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye, CalendarX2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import {
  STATUSES,
  statusLabel,
  toDateInput,
  localToIso,
  addMinutesIso,
  formatPrice,
} from "@/lib/format";
import { NoBusiness } from "@/components/painel/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/painel/")({
  head: () => ({
    meta: [
      { title: "Agenda do dia — Agenda Agora" },
      { name: "description", content: "Veja e gerencie os agendamentos do dia do seu negócio." },
      { property: "og:title", content: "Agenda do dia — Agenda Agora" },
      { property: "og:description", content: "Veja e gerencie os agendamentos do dia." },
    ],
  }),
  component: AgendaPage,
});

type ScheduleHour = { starts_at: string; ends_at: string };
type ScheduleBlock = {
  id: string;
  professional_id: string | null;
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

function minutesOf(time: string) {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function timeOf(totalMinutes: number) {
  const safe = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function buildSlots(hours: ScheduleHour[]) {
  const slots = new Set<string>();
  for (const hour of hours) {
    const start = minutesOf(hour.starts_at);
    const end = minutesOf(hour.ends_at);
    for (let cursor = start; cursor < end; cursor += 60) slots.add(timeOf(cursor));
  }
  return [...slots].sort((a, b) => minutesOf(a) - minutesOf(b));
}

function slotOf(iso: string) {
  const value = new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [hour] = value.split(":");
  return `${hour}:00`;
}

const emptyForm = {
  customer_name: "",
  customer_phone: "",
  service_id: "",
  professional_id: "",
  time: "09:00",
  notes: "",
};

function AgendaPage() {
  const { businessId, business } = useBusiness();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(() => toDateInput(new Date()));
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const weekdayNumber = new Date(`${day}T12:00:00-03:00`).getDay();

  const { data: services } = useQuery({
    queryKey: ["services", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("business_id", businessId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: professionals } = useQuery({
    queryKey: ["professionals", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("*")
        .eq("business_id", businessId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: businessHours } = useQuery({
    queryKey: ["business_hours", businessId, weekdayNumber],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_hours")
        .select("starts_at, ends_at")
        .eq("business_id", businessId!)
        .eq("weekday", weekdayNumber)
        .order("starts_at");
      if (error) throw error;
      return data as ScheduleHour[];
    },
  });

  const { data: timeBlocks } = useQuery({
    queryKey: ["time_blocks", businessId, day, weekdayNumber],
    enabled: !!businessId,
    queryFn: async () => {
      const recurringQuery = supabase
        .from("time_blocks")
        .select("id, professional_id, starts_at, ends_at, reason")
        .eq("business_id", businessId!)
        .eq("recurring", true)
        .eq("weekday", weekdayNumber);
      const specificQuery = supabase
        .from("time_blocks")
        .select("id, professional_id, starts_at, ends_at, reason")
        .eq("business_id", businessId!)
        .eq("recurring", false)
        .eq("block_date", day);
      const [recurring, specific] = await Promise.all([recurringQuery, specificQuery]);
      if (recurring.error) throw recurring.error;
      if (specific.error) throw specific.error;
      return [...(recurring.data ?? []), ...(specific.data ?? [])] as ScheduleBlock[];
    },
  });

  const { data: appointments } = useQuery({
    queryKey: ["appointments", businessId, day],
    enabled: !!businessId,
    queryFn: async () => {
      const start = new Date(`${day}T00:00:00-03:00`).toISOString();
      const end = new Date(`${day}T23:59:59-03:00`).toISOString();
      const { data, error } = await supabase
        .from("appointments")
        .select("*, services(name, price_cents), professionals(name)")
        .eq("business_id", businessId!)
        .gte("starts_at", start)
        .lte("starts_at", end)
        .neq("status", "aguardando_sinal")
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });

  const invalidateAppointments = () =>
    queryClient.invalidateQueries({ queryKey: ["appointments", businessId, day] });

  const invalidateBlocks = () =>
    queryClient.invalidateQueries({ queryKey: ["time_blocks", businessId, day, weekdayNumber] });

  const create = useMutation({
    mutationFn: async () => {
      const service = services?.find((s) => s.id === form.service_id);
      const startsAt = localToIso(day, form.time);
      const { error } = await supabase.from("appointments").insert({
        business_id: businessId!,
        service_id: form.service_id || null,
        professional_id: form.professional_id || null,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        starts_at: startsAt,
        ends_at: addMinutesIso(startsAt, service?.duration_minutes ?? 30),
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento criado!");
      setOpen(false);
      setForm(emptyForm);
      void invalidateAppointments();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blockSlot = useMutation({
    mutationFn: async (time: string) => {
      const { error } = await supabase.from("time_blocks").insert({
        business_id: businessId!,
        recurring: false,
        block_date: day,
        weekday: null,
        starts_at: time,
        ends_at: timeOf(minutesOf(time) + 60),
        reason: "Bloqueio rápido pela agenda",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horário bloqueado.");
      void invalidateBlocks();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blockDay = useMutation({
    mutationFn: async () => {
      const hours = businessHours ?? [];
      if (!hours.length) throw new Error("Configure primeiro os horários de funcionamento deste dia.");
      const rows = hours.map((hour) => ({
        business_id: businessId!,
        recurring: false,
        block_date: day,
        weekday: null,
        starts_at: hour.starts_at,
        ends_at: hour.ends_at,
        reason: "Dia bloqueado pela agenda",
      }));
      const { error } = await supabase.from("time_blocks").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dia bloqueado para novos agendamentos.");
      void invalidateBlocks();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidateAppointments(),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento removido.");
      setDetail(null);
      void invalidateAppointments();
    },
  });

  if (!businessId) return <NoBusiness />;

  const shiftDay = (delta: number) => {
    const next = new Date(`${day}T12:00:00-03:00`);
    next.setDate(next.getDate() + delta);
    setDay(toDateInput(next));
  };

  const slots = buildSlots([{ starts_at: "08:00", ends_at: "20:00" }]);
  const bySlot = new Map<string, (typeof appointments extends (infer T)[] | undefined ? T : never)[]>();
  for (const appointment of appointments ?? []) {
    const key = slotOf(appointment.starts_at);
    bySlot.set(key, [...(bySlot.get(key) ?? []), appointment]);
  }

  const blockForSlot = (slot: string) => {
    const minute = minutesOf(slot);
    return (timeBlocks ?? []).find(
      (block) =>
        !block.professional_id &&
        minute >= minutesOf(block.starts_at) &&
        minute < minutesOf(block.ends_at),
    );
  };

  const weekday = new Date(`${day}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    timeZone: "America/Sao_Paulo",
  });
  const total = (appointments ?? []).reduce(
    (sum, appointment) =>
      appointment.status !== "cancelado" && appointment.status !== "bloqueado"
        ? sum + ((appointment.services as { price_cents: number } | null)?.price_cents ?? 0)
        : sum,
    0,
  );
  const selected = (appointments ?? []).find((appointment) => appointment.id === detail) ?? null;
  const freeSlots = slots.filter((slot) => {
    const hasBusyAppointment = (bySlot.get(slot) ?? []).some((appointment) => appointment.status !== "cancelado");
    return !hasBusyAppointment && !blockForSlot(slot);
  });
  const scheduleLabel = (businessHours ?? [])
    .map((hour) => `${hour.starts_at.slice(0, 5)}–${hour.ends_at.slice(0, 5)}`)
    .join(" · ");

  const openNewAt = (time: string) => {
    setForm({ ...emptyForm, time });
    setOpen(true);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => shiftDay(-1)} aria-label="Dia anterior">
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          type="date"
          className="w-44"
          value={day}
          onChange={(event) => setDay(event.target.value)}
          aria-label="Data da agenda"
        />
        <Button variant="outline" size="icon" onClick={() => shiftDay(1)} aria-label="Próximo dia">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="mt-2 pl-12">
        <p className="text-[0.82rem] font-medium capitalize">{weekday}</p>
        <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
          {scheduleLabel || "Sem expediente configurado para este dia"}
        </p>
      </div>

      <button
        type="button"
        onClick={() => openNewAt(freeSlots[0] ?? slots[0] ?? "09:00")}
        className="mt-2 ml-12 w-44 rounded-md bg-warning/70 px-4 py-2.5 text-[0.82rem] font-medium text-warning-foreground transition-opacity hover:opacity-90"
      >
        Encaixe
      </button>

      <div className="mt-8 flex items-center gap-3">
        <span className="flex size-16 items-center justify-center rounded-full bg-secondary text-xs font-bold uppercase text-muted-foreground">
          {(business?.name ?? "??").slice(0, 2)}
        </span>
        <div>
          <h1 className="text-[1.2rem] font-medium">Agenda</h1>
          <p className="text-xs text-muted-foreground">
            {freeSlots.length} horário(s) livre(s) neste dia
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="icon" aria-label="Visualizar">
            <Eye className="size-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Bloquear dia"
            title="Bloquear todos os horários deste dia"
            onClick={() => blockDay.mutate()}
            disabled={blockDay.isPending || !slots.length}
          >
            <CalendarX2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-border">
        <div className="h-8 bg-secondary" />
        {!slots.length ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium">Nenhum horário disponível neste dia</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure os dias fixos e horários de trabalho na opção Funcionamento da barra lateral.
            </p>
          </div>
        ) : (
          <ul>
            {slots.map((slot) => {
              const items = bySlot.get(slot) ?? [];
              const block = blockForSlot(slot);
              if (!items.length && block) {
                return (
                  <li key={slot}>
                    <div className="flex w-full items-center gap-4 border-b border-background bg-slot-blocked px-4 py-2.5 text-slot-blocked-foreground">
                      <span className="w-14 font-bold">{slot}</span>
                      <span className="flex-1 text-center text-sm font-medium">
                        Horário bloqueado
                        {block.reason ? <span className="ml-2 text-xs opacity-75">{block.reason}</span> : null}
                      </span>
                      <span className="w-16" />
                    </div>
                  </li>
                );
              }

              if (!items.length) {
                return (
                  <li key={slot} className="group relative">
                    <button
                      type="button"
                      onClick={() => openNewAt(slot)}
                      className="flex w-full items-center gap-4 border-b border-background bg-slot-free px-4 py-2.5 text-left text-slot-free-foreground transition-opacity hover:opacity-90"
                    >
                      <span className="w-14 font-medium">{slot}</span>
                      <span className="flex-1 text-center text-xs font-medium uppercase tracking-wide opacity-70">
                        Disponível
                      </span>
                      <span className="w-16" />
                    </button>
                    <button
                      type="button"
                      onClick={() => blockSlot.mutate(slot)}
                      aria-label={`Bloquear ${slot}`}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-slot-blocked px-2 py-1 text-[11px] font-semibold text-slot-blocked-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      Bloquear
                    </button>
                  </li>
                );
              }

              return items.map((appointment) => {
                const paid = appointment.status === "concluido";
                const cancelled = appointment.status === "cancelado";
                const blocked = appointment.status === "bloqueado";
                const tone = blocked
                  ? "bg-slot-blocked text-slot-blocked-foreground"
                  : cancelled
                    ? "bg-slot-empty text-slot-empty-foreground line-through"
                    : paid
                      ? "bg-slot-paid text-slot-paid-foreground"
                      : "bg-slot-booked text-slot-booked-foreground";
                const price =
                  (appointment.services as { price_cents: number } | null)?.price_cents ?? 0;
                return (
                  <li key={appointment.id}>
                    <button
                      type="button"
                      onClick={() => setDetail(appointment.id)}
                      className={`flex w-full items-center gap-4 border-b border-background px-4 py-2.5 text-left transition-opacity hover:opacity-90 ${tone}`}
                    >
                      <span className="w-14 font-bold">{slot}</span>
                      <span className="flex-1 text-center text-sm">
                        <span className="block font-medium">
                          {blocked ? "Horário bloqueado" : appointment.customer_name}
                        </span>
                        {!blocked && appointment.customer_phone && (
                          <span className="block text-xs opacity-80">{appointment.customer_phone}</span>
                        )}
                      </span>
                      {!blocked && (
                        <span className="hidden text-xs font-medium uppercase sm:block">
                          {(appointment.services as { name: string } | null)?.name ?? "Serviço"}
                          {price > 0 ? ` - ${formatPrice(price)}` : ""}
                        </span>
                      )}
                      <span className="w-16 text-right text-xs">
                        {paid ? formatPrice(price) : ""}
                      </span>
                    </button>
                  </li>
                );
              });
            })}
          </ul>
        )}
      </div>

      <p className="mt-4 text-right text-sm text-muted-foreground">
        {(appointments ?? []).length} agendamento(s) · {freeSlots.length} livre(s) · {formatPrice(total)}
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="aname">Cliente</Label>
                <Input
                  id="aname"
                  value={form.customer_name}
                  onChange={(event) => setForm({ ...form, customer_name: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aphone">Telefone</Label>
                <Input
                  id="aphone"
                  value={form.customer_phone}
                  onChange={(event) => setForm({ ...form, customer_phone: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Serviço</Label>
              <Select
                value={form.service_id}
                onValueChange={(value) => setForm({ ...form, service_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um serviço" />
                </SelectTrigger>
                <SelectContent>
                  {(services ?? []).map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} · {service.duration_minutes} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Profissional</Label>
                <Select
                  value={form.professional_id}
                  onValueChange={(value) => setForm({ ...form, professional_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Qualquer um" />
                  </SelectTrigger>
                  <SelectContent>
                    {(professionals ?? []).map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>
                        {professional.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="atime">Horário</Label>
                <Input
                  id="atime"
                  type="time"
                  value={form.time}
                  onChange={(event) => setForm({ ...form, time: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="anotes">Observações</Label>
              <Textarea
                id="anotes"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => create.mutate()}
              disabled={!form.customer_name.trim() || create.isPending}
            >
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(value) => !value && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.customer_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                {(selected.services as { name: string } | null)?.name ?? "Sem serviço"} ·{" "}
                {slotOf(selected.starts_at)}
                {selected.customer_phone ? ` · ${selected.customer_phone}` : ""}
              </p>
              {selected.notes && <p className="text-muted-foreground">{selected.notes}</p>}
              <div className="space-y-2">
                <Label>Situação</Label>
                <Select
                  value={selected.status}
                  onValueChange={(status) => setStatus.mutate({ id: selected.id, status })}
                >
                  <SelectTrigger>
                    <SelectValue>{statusLabel(selected.status)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => selected && remove.mutate(selected.id)}
              disabled={remove.isPending}
            >
              <Trash2 className="size-4" /> Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

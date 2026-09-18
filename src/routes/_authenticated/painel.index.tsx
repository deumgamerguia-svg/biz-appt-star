import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Eye, CalendarX2, Trash2, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import {
  STATUSES,
  statusLabel,
  toDateInput,
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
      {
        name: "description",
        content: "Veja e gerencie os agendamentos do dia do seu negócio.",
      },
      { property: "og:title", content: "Agenda do dia — Agenda Agora" },
      {
        property: "og:description",
        content: "Veja e gerencie os agendamentos do dia.",
      },
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
  recurring: boolean;
  block_date: string | null;
};

type ServiceLink = {
  service_id: string;
  professional_id: string;
};

const SLOT_MINUTES = 30;
const DAY_BLOCK_REASON = "Dia bloqueado pela agenda";
const QUICK_BLOCK_REASON = "Bloqueio rápido pela agenda";

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
    for (let cursor = start; cursor < end; cursor += SLOT_MINUTES) {
      slots.add(timeOf(cursor));
    }
  }
  return [...slots].sort((a, b) => minutesOf(a) - minutesOf(b));
}

function timeFromIso(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function toAgendaIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

function overlaps(start: number, end: number, otherStart: number, otherEnd: number) {
  return start < otherEnd && end > otherStart;
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
  const [showCancelled, setShowCancelled] = useState(true);
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
        .select("id, name, working_days")
        .eq("business_id", businessId!)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: serviceLinks } = useQuery({
    queryKey: ["service-links", businessId],
    enabled: !!businessId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_professionals")
        .select("service_id, professional_id")
        .eq("business_id", businessId!);
      if (error) throw error;
      return data as ServiceLink[];
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
        .select("id, professional_id, starts_at, ends_at, reason, recurring, block_date")
        .eq("business_id", businessId!)
        .eq("recurring", true)
        .eq("weekday", weekdayNumber);
      const specificQuery = supabase
        .from("time_blocks")
        .select("id, professional_id, starts_at, ends_at, reason, recurring, block_date")
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
    queryClient.invalidateQueries({
      queryKey: ["time_blocks", businessId, day, weekdayNumber],
    });

  const validateAppointment = () => {
    const customerName = form.customer_name.trim();
    if (!customerName) throw new Error("Informe o nome do cliente.");
    if (!form.service_id) throw new Error("Selecione um serviço.");

    const service = services?.find((item) => item.id === form.service_id);
    if (!service) throw new Error("O serviço selecionado não está mais disponível.");

    const linkedProfessionals = (serviceLinks ?? []).filter(
      (link) => link.service_id === service.id,
    );
    if (linkedProfessionals.length) {
      if (!form.professional_id) {
        throw new Error("Selecione um profissional habilitado para este serviço.");
      }
      if (!linkedProfessionals.some((link) => link.professional_id === form.professional_id)) {
        throw new Error("Este profissional não está vinculado ao serviço selecionado.");
      }
    }

    if (form.professional_id) {
      const professional = professionals?.find((item) => item.id === form.professional_id);
      if (!professional) throw new Error("O profissional selecionado não está mais disponível.");
      if (!(professional.working_days ?? []).includes(weekdayNumber)) {
        throw new Error("Este profissional não atende no dia selecionado.");
      }
    }

    const startMinute = minutesOf(form.time);
    const endMinute = startMinute + service.duration_minutes;
    const isInsideBusinessHours = (businessHours ?? []).some(
      (hour) =>
        startMinute >= minutesOf(hour.starts_at) && endMinute <= minutesOf(hour.ends_at),
    );
    if (!isInsideBusinessHours) {
      throw new Error("O horário e a duração do serviço precisam caber dentro do expediente.");
    }

    const conflictingBlock = (timeBlocks ?? []).find((block) => {
      const appliesToProfessional =
        !block.professional_id || block.professional_id === form.professional_id;
      return (
        appliesToProfessional &&
        overlaps(
          startMinute,
          endMinute,
          minutesOf(block.starts_at),
          minutesOf(block.ends_at),
        )
      );
    });
    if (conflictingBlock) {
      throw new Error("Esse período está bloqueado. Desbloqueie o horário ou escolha outro.");
    }

    const conflictingAppointment = (appointments ?? []).find((appointment) => {
      if (appointment.status === "cancelado" || appointment.status === "aguardando_sinal") {
        return false;
      }
      if (
        form.professional_id &&
        appointment.professional_id &&
        appointment.professional_id !== form.professional_id
      ) {
        return false;
      }
      const appointmentStart = minutesOf(timeFromIso(appointment.starts_at));
      const appointmentEnd = minutesOf(timeFromIso(appointment.ends_at));
      return overlaps(startMinute, endMinute, appointmentStart, appointmentEnd);
    });
    if (conflictingAppointment) {
      throw new Error("Já existe um agendamento ocupando esse período.");
    }

    const startsAt = toAgendaIso(day, form.time);
    return {
      service,
      startsAt,
      endsAt: addMinutesIso(startsAt, service.duration_minutes),
      customerName,
    };
  };

  const create = useMutation({
    mutationFn: async () => {
      const { startsAt, endsAt, customerName } = validateAppointment();
      const { error } = await supabase.from("appointments").insert({
        business_id: businessId!,
        service_id: form.service_id,
        professional_id: form.professional_id || null,
        customer_name: customerName,
        customer_phone: form.customer_phone.trim() || null,
        starts_at: startsAt,
        ends_at: endsAt,
        notes: form.notes.trim() || null,
        status: "agendado",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento criado e salvo na agenda.");
      setOpen(false);
      setForm(emptyForm);
      void invalidateAppointments();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const blockSlot = useMutation({
    mutationFn: async (time: string) => {
      const startMinute = minutesOf(time);
      const endMinute = startMinute + SLOT_MINUTES;
      const hasAppointment = (appointments ?? []).some((appointment) => {
        if (appointment.status === "cancelado" || appointment.status === "aguardando_sinal") {
          return false;
        }
        return overlaps(
          startMinute,
          endMinute,
          minutesOf(timeFromIso(appointment.starts_at)),
          minutesOf(timeFromIso(appointment.ends_at)),
        );
      });
      if (hasAppointment) {
        throw new Error("Não é possível bloquear um período que já possui agendamento.");
      }

      const alreadyBlocked = (timeBlocks ?? []).some(
        (block) =>
          !block.professional_id &&
          overlaps(
            startMinute,
            endMinute,
            minutesOf(block.starts_at),
            minutesOf(block.ends_at),
          ),
      );
      if (alreadyBlocked) throw new Error("Este período já está bloqueado.");

      const { error } = await supabase.from("time_blocks").insert({
        business_id: businessId!,
        recurring: false,
        block_date: day,
        weekday: null,
        starts_at: time,
        ends_at: timeOf(endMinute),
        reason: QUICK_BLOCK_REASON,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horário bloqueado e salvo.");
      void invalidateBlocks();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unblockSlot = useMutation({
    mutationFn: async (block: ScheduleBlock) => {
      if (block.recurring) {
        throw new Error("Bloqueios recorrentes devem ser alterados na tela Bloqueios.");
      }
      const { error } = await supabase
        .from("time_blocks")
        .delete()
        .eq("id", block.id)
        .eq("business_id", businessId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horário desbloqueado.");
      void invalidateBlocks();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dayBlocks = (timeBlocks ?? []).filter(
    (block) =>
      !block.recurring &&
      !block.professional_id &&
      block.block_date === day &&
      block.reason === DAY_BLOCK_REASON,
  );
  const dayBlocked = dayBlocks.length > 0;

  const toggleDayBlock = useMutation({
    mutationFn: async () => {
      if (dayBlocks.length) {
        const { error } = await supabase
          .from("time_blocks")
          .delete()
          .eq("business_id", businessId!)
          .in(
            "id",
            dayBlocks.map((block) => block.id),
          );
        if (error) throw error;
        return "unblocked" as const;
      }

      const hours = businessHours ?? [];
      if (!hours.length) {
        throw new Error("Configure primeiro os horários de funcionamento deste dia.");
      }
      const rows = hours.map((hour) => ({
        business_id: businessId!,
        recurring: false,
        block_date: day,
        weekday: null,
        starts_at: hour.starts_at,
        ends_at: hour.ends_at,
        reason: DAY_BLOCK_REASON,
      }));
      const { error } = await supabase.from("time_blocks").insert(rows);
      if (error) throw error;
      return "blocked" as const;
    },
    onSuccess: (action) => {
      toast.success(
        action === "blocked"
          ? "Dia bloqueado para novos agendamentos."
          : "Dia desbloqueado para novos agendamentos.",
      );
      void invalidateBlocks();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", id)
        .eq("business_id", businessId!);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(`Situação alterada para ${statusLabel(status)}.`);
      void invalidateAppointments();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id)
        .eq("business_id", businessId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agendamento removido da agenda.");
      setDetail(null);
      void invalidateAppointments();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (!businessId) return <NoBusiness />;

  const shiftDay = (delta: number) => {
    const next = new Date(`${day}T12:00:00-03:00`);
    next.setDate(next.getDate() + delta);
    setDay(toDateInput(next));
  };

  const baseSlots = buildSlots(businessHours ?? []);
  const timelineSlots = [
    ...new Set([
      ...baseSlots,
      ...(appointments ?? []).map((appointment) => timeFromIso(appointment.starts_at)),
    ]),
  ].sort((a, b) => minutesOf(a) - minutesOf(b));

  type Appointment = NonNullable<typeof appointments>[number];
  const visibleAppointments = (appointments ?? []).filter(
    (appointment) => showCancelled || appointment.status !== "cancelado",
  );
  const bySlot = new Map<string, Appointment[]>();
  for (const appointment of visibleAppointments) {
    const key = timeFromIso(appointment.starts_at);
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

  const selected =
    (appointments ?? []).find((appointment) => appointment.id === detail) ?? null;

  const freeSlots = baseSlots.filter((slot) => {
    const startMinute = minutesOf(slot);
    const endMinute = startMinute + SLOT_MINUTES;
    const hasBusyAppointment = (appointments ?? []).some((appointment) => {
      if (appointment.status === "cancelado" || appointment.status === "aguardando_sinal") {
        return false;
      }
      return overlaps(
        startMinute,
        endMinute,
        minutesOf(timeFromIso(appointment.starts_at)),
        minutesOf(timeFromIso(appointment.ends_at)),
      );
    });
    const hasBlock = (timeBlocks ?? []).some(
      (block) =>
        !block.professional_id &&
        overlaps(
          startMinute,
          endMinute,
          minutesOf(block.starts_at),
          minutesOf(block.ends_at),
        ),
    );
    return !hasBusyAppointment && !hasBlock;
  });

  const scheduleLabel = (businessHours ?? [])
    .map((hour) => `${hour.starts_at.slice(0, 5)}–${hour.ends_at.slice(0, 5)}`)
    .join(" · ");

  const linkedForSelectedService = (serviceLinks ?? []).filter(
    (link) => link.service_id === form.service_id,
  );
  const linkedIds = new Set(linkedForSelectedService.map((link) => link.professional_id));
  const eligibleProfessionals = (professionals ?? []).filter((professional) => {
    const worksToday = (professional.working_days ?? []).includes(weekdayNumber);
    const linked = !linkedForSelectedService.length || linkedIds.has(professional.id);
    return worksToday && linked;
  });

  const openNewAt = (time: string) => {
    setForm({ ...emptyForm, time });
    setOpen(true);
  };

  const handleServiceChange = (serviceId: string) => {
    const links = (serviceLinks ?? []).filter((link) => link.service_id === serviceId);
    setForm((current) => ({
      ...current,
      service_id: serviceId,
      professional_id:
        current.professional_id &&
        (!links.length || links.some((link) => link.professional_id === current.professional_id))
          ? current.professional_id
          : "",
    }));
  };

  const handleDelete = () => {
    if (!selected) return;
    if (!window.confirm(`Excluir o agendamento de ${selected.customer_name}?`)) return;
    remove.mutate(selected.id);
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => shiftDay(-1)}
          aria-label="Dia anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Input
          type="date"
          className="w-44"
          value={day}
          onChange={(event) => setDay(event.target.value)}
          aria-label="Data da agenda"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => shiftDay(1)}
          aria-label="Próximo dia"
        >
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
        onClick={() => openNewAt(freeSlots[0] ?? baseSlots[0] ?? "09:00")}
        disabled={!baseSlots.length}
        className="group mt-3 ml-12 block w-[calc(100%-3rem)] max-w-[650px] rounded-[28px] bg-[linear-gradient(112deg,rgba(240,196,72,0.48)_0%,rgba(166,123,26,0.24)_38%,rgba(114,84,22,0.14)_72%,rgba(216,166,43,0.22)_100%)] p-px text-left shadow-[0_12px_34px_rgba(0,0,0,0.34),0_0_34px_rgba(204,154,35,0.04)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_16px_38px_rgba(0,0,0,0.38),0_0_38px_rgba(204,154,35,0.07)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
      >
        <span className="flex h-[136px] w-full items-center gap-5 rounded-[27px] bg-[radial-gradient(circle_at_15%_50%,rgba(179,131,24,0.13)_0%,rgba(70,53,18,0.07)_28%,transparent_52%),linear-gradient(100deg,#0c0b08_0%,#0b0b0a_50%,#0d0c09_100%)] px-7">
          <span className="flex size-[76px] shrink-0 items-center justify-center rounded-[20px] bg-[linear-gradient(145deg,rgba(232,188,61,0.42),rgba(106,78,20,0.20))] p-px shadow-[inset_0_0_0_1px_rgba(255,221,126,0.06),0_8px_24px_rgba(114,78,10,0.16)]">
            <span className="flex size-full items-center justify-center rounded-[19px] bg-[radial-gradient(circle_at_35%_30%,rgba(163,120,27,0.24),rgba(41,34,16,0.88)_64%,rgba(24,22,15,0.96)_100%)]">
              <Zap className="size-8 text-[#f5dc95] drop-shadow-[0_0_8px_rgba(237,197,85,0.16)]" strokeWidth={2.1} />
            </span>
          </span>
          <span className="min-w-0">
            <span className="block text-[2rem] font-semibold leading-none tracking-[-0.035em] text-[#f7f7f7]">
              Encaixe
            </span>
            <span className="mt-3 block truncate text-[1rem] font-normal leading-none tracking-[-0.015em] text-[#76727b]">
              Agendamento rápido · próximo horário disponível
            </span>
          </span>
        </span>
      </button>

      <div className="mt-8 flex items-center gap-3">
        <span className="flex size-16 items-center justify-center rounded-full bg-secondary text-xs font-bold uppercase text-muted-foreground">
          {(business?.name ?? "??").slice(0, 2)}
        </span>
        <div>
          <h1 className="text-[1.2rem] font-medium">Agenda</h1>
          <p className="text-xs text-muted-foreground">
            {freeSlots.length} horário(s) base livre(s) neste dia
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            aria-label={showCancelled ? "Ocultar cancelados" : "Mostrar cancelados"}
            title={showCancelled ? "Ocultar agendamentos cancelados" : "Mostrar agendamentos cancelados"}
            aria-pressed={showCancelled}
            onClick={() => setShowCancelled((value) => !value)}
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant={dayBlocked ? "destructive" : "secondary"}
            size="icon"
            aria-label={dayBlocked ? "Desbloquear dia" : "Bloquear dia"}
            title={
              dayBlocked
                ? "Desbloquear os horários bloqueados por esta ação"
                : "Bloquear todos os horários deste dia"
            }
            onClick={() => toggleDayBlock.mutate()}
            disabled={toggleDayBlock.isPending || !baseSlots.length}
          >
            <CalendarX2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-border">
        <div className="h-8 bg-secondary" />
        {!timelineSlots.length ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium">Nenhum horário disponível neste dia</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure os dias fixos e horários de trabalho na opção Funcionamento da barra
              lateral.
            </p>
          </div>
        ) : (
          <ul>
            {timelineSlots.map((slot) => {
              const items = bySlot.get(slot) ?? [];
              const block = blockForSlot(slot);

              if (!items.length && block) {
                return (
                  <li key={slot}>
                    <div className="flex w-full items-center gap-4 border-b border-background bg-slot-blocked px-4 py-2.5 text-slot-blocked-foreground">
                      <span className="w-14 font-bold">{slot}</span>
                      <span className="flex-1 text-center text-sm font-medium">
                        Horário bloqueado
                        {block.reason ? (
                          <span className="ml-2 text-xs opacity-75">{block.reason}</span>
                        ) : null}
                      </span>
                      <span className="w-24 text-right">
                        {block.recurring ? (
                          <span className="text-[10px] font-semibold uppercase opacity-70">
                            Recorrente
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => unblockSlot.mutate(block)}
                            disabled={unblockSlot.isPending}
                            className="rounded-md bg-background/30 px-2 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                          >
                            Desbloquear
                          </button>
                        )}
                      </span>
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
                      <span className="w-24" />
                    </button>
                    <button
                      type="button"
                      onClick={() => blockSlot.mutate(slot)}
                      disabled={blockSlot.isPending}
                      aria-label={`Bloquear ${slot}`}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-slot-blocked px-2 py-1 text-[11px] font-semibold text-slot-blocked-foreground opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
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
                      <span className="w-14 font-bold">{timeFromIso(appointment.starts_at)}</span>
                      <span className="flex-1 text-center text-sm">
                        <span className="block font-medium">
                          {blocked ? "Horário bloqueado" : appointment.customer_name}
                        </span>
                        {!blocked && appointment.customer_phone && (
                          <span className="block text-xs opacity-80">
                            {appointment.customer_phone}
                          </span>
                        )}
                        {!blocked && appointment.professionals && (
                          <span className="block text-[11px] opacity-70">
                            {(appointment.professionals as { name: string }).name}
                          </span>
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
        {(appointments ?? []).length} agendamento(s) · {freeSlots.length} livre(s) ·{" "}
        {formatPrice(total)}
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
              <Select value={form.service_id} onValueChange={handleServiceChange}>
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
                  value={form.professional_id || undefined}
                  onValueChange={(value) => setForm({ ...form, professional_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        form.service_id && linkedForSelectedService.length
                          ? "Selecione o profissional"
                          : "Opcional"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleProfessionals.map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>
                        {professional.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.service_id && !eligibleProfessionals.length ? (
                  <p className="text-[11px] text-destructive">
                    Nenhum profissional habilitado atende neste dia.
                  </p>
                ) : null}
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
              disabled={!form.customer_name.trim() || !form.service_id || create.isPending}
            >
              {create.isPending ? "Salvando..." : "Agendar"}
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
                {timeFromIso(selected.starts_at)}–{timeFromIso(selected.ends_at)}
                {selected.customer_phone ? ` · ${selected.customer_phone}` : ""}
              </p>
              {selected.professionals ? (
                <p className="text-muted-foreground">
                  Profissional: {(selected.professionals as { name: string }).name}
                </p>
              ) : null}
              {selected.notes && <p className="text-muted-foreground">{selected.notes}</p>}

              <div className="space-y-2">
                <Label>Situação</Label>
                <Select
                  value={selected.status}
                  onValueChange={(status) =>
                    setStatus.mutate({ id: selected.id, status })
                  }
                  disabled={setStatus.isPending}
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
            <Button variant="destructive" onClick={handleDelete} disabled={remove.isPending}>
              <Trash2 className="size-4" />
              {remove.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

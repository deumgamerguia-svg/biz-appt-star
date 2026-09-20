import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { ChevronLeft, ChevronRight, Eye, CalendarX2, Trash2, Clock3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RuntimeProfiler } from "@/lib/runtime-profiler";
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
  component: ProfiledAgendaPage,
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

const AGENDA_TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const AGENDA_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
});
const AGENDA_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  timeZone: "America/Sao_Paulo",
});
const AGENDA_SIGNAL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function timeFromIso(iso: string) {
  return AGENDA_TIME_FORMATTER.format(new Date(iso));
}

function toAgendaIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

function agendaDateLabel(date: string) {
  return AGENDA_DATE_FORMATTER.format(new Date(`${date}T12:00:00-03:00`));
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
  recurring: false,
};

function ProfiledAgendaPage() {
  return (
    <RuntimeProfiler id="AgendaPage">
      <AgendaPage />
    </RuntimeProfiler>
  );
}

function AgendaPage() {
  const { businessId, business } = useBusiness();
  const queryClient = useQueryClient();
  const [day, setDay] = useState(() => toDateInput(new Date()));
  const [open, setOpen] = useState(false);
  const [encaixeOpen, setEncaixeOpen] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [showCancelled, setShowCancelled] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [encaixeForm, setEncaixeForm] = useState({ ...emptyForm, time: "" });
  const weekdayNumber = useMemo(() => new Date(`${day}T12:00:00-03:00`).getDay(), [day]);

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
      const { service, startsAt, endsAt, customerName } = validateAppointment();
      const { error } = await supabase.from("appointments").insert({
        business_id: businessId!,
        service_id: form.service_id,
        professional_id: form.professional_id || null,
        customer_name: customerName,
        customer_phone: form.customer_phone.trim() || null,
        starts_at: startsAt,
        ends_at: endsAt,
        deposit_cents: service.deposit_cents ?? 0,
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

  const validateEncaixe = () => {
    const customerName = encaixeForm.customer_name.trim();
    if (!customerName) throw new Error("Informe o nome do cliente.");
    if (!encaixeForm.service_id) throw new Error("Selecione um serviço.");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(encaixeForm.time)) {
      throw new Error("Informe um horário válido para o encaixe.");
    }

    const service = services?.find((item) => item.id === encaixeForm.service_id);
    if (!service) throw new Error("O serviço selecionado não está mais disponível.");

    if (encaixeForm.professional_id) {
      const professional = professionals?.find(
        (item) => item.id === encaixeForm.professional_id,
      );
      if (!professional) {
        throw new Error("O profissional selecionado não está mais disponível.");
      }

      const linkedProfessionals = (serviceLinks ?? []).filter(
        (link) => link.service_id === service.id,
      );
      if (
        linkedProfessionals.length &&
        !linkedProfessionals.some(
          (link) => link.professional_id === encaixeForm.professional_id,
        )
      ) {
        throw new Error("Este profissional não está vinculado ao serviço selecionado.");
      }
    }

    // Encaixe é uma exceção manual: não depende dos slots de 30 minutos,
    // expediente, dia de trabalho ou bloqueios da grade.
    const startsAt = toAgendaIso(day, encaixeForm.time);
    return {
      service,
      startsAt,
      endsAt: addMinutesIso(startsAt, service.duration_minutes),
      customerName,
    };
  };

  const createEncaixe = useMutation({
    mutationFn: async () => {
      const { service, startsAt, endsAt, customerName } = validateEncaixe();
      const { error } = await supabase.from("appointments").insert({
        business_id: businessId!,
        service_id: encaixeForm.service_id,
        professional_id: encaixeForm.professional_id || null,
        customer_name: customerName,
        customer_phone: encaixeForm.customer_phone.trim() || null,
        starts_at: startsAt,
        ends_at: endsAt,
        deposit_cents: service.deposit_cents ?? 0,
        notes: null,
        status: "agendado",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Encaixe criado e salvo na agenda.");
      setEncaixeOpen(false);
      setEncaixeForm({ ...emptyForm, time: "" });
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

  const dayBlocks = useMemo(
    () =>
      (timeBlocks ?? []).filter(
        (block) =>
          !block.recurring &&
          !block.professional_id &&
          block.block_date === day &&
          block.reason === DAY_BLOCK_REASON,
      ),
    [timeBlocks, day],
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

  const shiftDay = (delta: number) => {
    const next = new Date(`${day}T12:00:00-03:00`);
    next.setDate(next.getDate() + delta);
    setDay(toDateInput(next));
  };

  const baseSlots = useMemo(() => buildSlots(businessHours ?? []), [businessHours]);

  type Appointment = NonNullable<typeof appointments>[number];
  const appointmentTimes = useMemo(() => {
    const map = new Map<
      string,
      { startTime: string; startMinute: number; endMinute: number }
    >();
    for (const appointment of appointments ?? []) {
      const startTime = timeFromIso(appointment.starts_at);
      const endTime = timeFromIso(appointment.ends_at);
      map.set(appointment.id, {
        startTime,
        startMinute: minutesOf(startTime),
        endMinute: minutesOf(endTime),
      });
    }
    return map;
  }, [appointments]);

  const timelineSlots = useMemo(
    () =>
      [
        ...new Set([
          ...baseSlots,
          ...(appointments ?? []).map(
            (appointment) =>
              appointmentTimes.get(appointment.id)?.startTime ??
              timeFromIso(appointment.starts_at),
          ),
        ]),
      ].sort((a, b) => minutesOf(a) - minutesOf(b)),
    [baseSlots, appointments, appointmentTimes],
  );

  const bySlot = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of appointments ?? []) {
      if (!showCancelled && appointment.status === "cancelado") continue;
      const key =
        appointmentTimes.get(appointment.id)?.startTime ??
        timeFromIso(appointment.starts_at);
      const current = map.get(key);
      if (current) current.push(appointment);
      else map.set(key, [appointment]);
    }
    return map;
  }, [appointments, appointmentTimes, showCancelled]);

  const globalBlocks = useMemo(
    () =>
      (timeBlocks ?? [])
        .filter((block) => !block.professional_id)
        .map((block) => ({
          block,
          startMinute: minutesOf(block.starts_at),
          endMinute: minutesOf(block.ends_at),
        })),
    [timeBlocks],
  );

  const blockBySlot = useMemo(() => {
    const map = new Map<string, ScheduleBlock>();
    for (const slot of timelineSlots) {
      const minute = minutesOf(slot);
      const found = globalBlocks.find(
        ({ startMinute, endMinute }) =>
          minute >= startMinute && minute < endMinute,
      );
      if (found) map.set(slot, found.block);
    }
    return map;
  }, [timelineSlots, globalBlocks]);

  const blockForSlot = (slot: string) => blockBySlot.get(slot);

  const weekday = useMemo(
    () => AGENDA_WEEKDAY_FORMATTER.format(new Date(`${day}T12:00:00-03:00`)),
    [day],
  );

  const total = useMemo(
    () =>
      (appointments ?? []).reduce(
        (sum, appointment) =>
          appointment.status !== "cancelado" && appointment.status !== "bloqueado"
            ? sum +
              ((appointment.services as { price_cents: number } | null)?.price_cents ?? 0)
            : sum,
        0,
      ),
    [appointments],
  );

  const selected =
    (appointments ?? []).find((appointment) => appointment.id === detail) ?? null;

  const busyAppointmentRanges = useMemo(
    () =>
      (appointments ?? []).flatMap((appointment) => {
        if (
          appointment.status === "cancelado" ||
          appointment.status === "aguardando_sinal"
        ) {
          return [];
        }
        const timing = appointmentTimes.get(appointment.id);
        return timing
          ? [{ startMinute: timing.startMinute, endMinute: timing.endMinute }]
          : [];
      }),
    [appointments, appointmentTimes],
  );

  const freeSlots = useMemo(
    () =>
      baseSlots.filter((slot) => {
        const startMinute = minutesOf(slot);
        const endMinute = startMinute + SLOT_MINUTES;
        const hasBusyAppointment = busyAppointmentRanges.some((range) =>
          overlaps(
            startMinute,
            endMinute,
            range.startMinute,
            range.endMinute,
          ),
        );
        const hasBlock = globalBlocks.some((range) =>
          overlaps(
            startMinute,
            endMinute,
            range.startMinute,
            range.endMinute,
          ),
        );
        return !hasBusyAppointment && !hasBlock;
      }),
    [baseSlots, busyAppointmentRanges, globalBlocks],
  );

  const scheduleLabel = useMemo(
    () =>
      (businessHours ?? [])
        .map((hour) => `${hour.starts_at.slice(0, 5)}–${hour.ends_at.slice(0, 5)}`)
        .join(" · "),
    [businessHours],
  );

  const linkedForSelectedService = useMemo(
    () => (serviceLinks ?? []).filter((link) => link.service_id === form.service_id),
    [serviceLinks, form.service_id],
  );
  const linkedIds = useMemo(
    () => new Set(linkedForSelectedService.map((link) => link.professional_id)),
    [linkedForSelectedService],
  );
  const eligibleProfessionals = useMemo(
    () =>
      (professionals ?? []).filter((professional) => {
        const worksToday = (professional.working_days ?? []).includes(weekdayNumber);
        const linked =
          !linkedForSelectedService.length || linkedIds.has(professional.id);
        return worksToday && linked;
      }),
    [professionals, weekdayNumber, linkedForSelectedService.length, linkedIds],
  );

  const defaultProfessionalForService = (serviceId: string) => {
    const links = (serviceLinks ?? []).filter((link) => link.service_id === serviceId);
    if (!links.length) return "";

    const linkedIds = new Set(links.map((link) => link.professional_id));
    return (
      (professionals ?? []).find(
        (professional) =>
          linkedIds.has(professional.id) &&
          (professional.working_days ?? []).includes(weekdayNumber),
      )?.id ?? ""
    );
  };

  const openNewAt = (time: string) => {
    const defaultService = services?.[0]?.id ?? "";
    setForm({
      ...emptyForm,
      time,
      service_id: defaultService,
      professional_id: defaultService ? defaultProfessionalForService(defaultService) : "",
    });
    setOpen(true);
  };

  const handleServiceChange = (serviceId: string) => {
    const links = (serviceLinks ?? []).filter((link) => link.service_id === serviceId);
    const linkedIds = new Set(links.map((link) => link.professional_id));

    setForm((current) => {
      const currentProfessional = (professionals ?? []).find(
        (professional) => professional.id === current.professional_id,
      );
      const currentStillValid =
        !!currentProfessional &&
        (currentProfessional.working_days ?? []).includes(weekdayNumber) &&
        (!links.length || linkedIds.has(currentProfessional.id));

      return {
        ...current,
        service_id: serviceId,
        professional_id: currentStillValid
          ? current.professional_id
          : defaultProfessionalForService(serviceId),
      };
    });
  };

  const encaixeLinkedForSelectedService = useMemo(
    () =>
      (serviceLinks ?? []).filter(
        (link) => link.service_id === encaixeForm.service_id,
      ),
    [serviceLinks, encaixeForm.service_id],
  );
  const encaixeLinkedIds = useMemo(
    () =>
      new Set(
        encaixeLinkedForSelectedService.map((link) => link.professional_id),
      ),
    [encaixeLinkedForSelectedService],
  );
  const encaixeProfessionals = useMemo(
    () =>
      (professionals ?? []).filter(
        (professional) =>
          !encaixeLinkedForSelectedService.length ||
          encaixeLinkedIds.has(professional.id),
      ),
    [professionals, encaixeLinkedForSelectedService.length, encaixeLinkedIds],
  );

  const openEncaixe = () => {
    setEncaixeForm({
      ...emptyForm,
      time: "",
      service_id: services?.[0]?.id ?? "",
      professional_id: "",
    });
    setEncaixeOpen(true);
  };

  const handleEncaixeServiceChange = (serviceId: string) => {
    const links = (serviceLinks ?? []).filter((link) => link.service_id === serviceId);
    const linkedIds = new Set(links.map((link) => link.professional_id));

    setEncaixeForm((current) => ({
      ...current,
      service_id: serviceId,
      professional_id:
        current.professional_id &&
        (!links.length || linkedIds.has(current.professional_id))
          ? current.professional_id
          : "",
    }));
  };

  const handleDelete = () => {
    if (!selected) return;
    if (!window.confirm(`Excluir o agendamento de ${selected.customer_name}?`)) return;
    remove.mutate(selected.id);
  };

  if (!businessId) return <NoBusiness />;

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
        <div className="relative min-w-0 flex-1 rounded-md">

          <span
            aria-hidden="true"
            className="date-border-beam pointer-events-none absolute inset-[-1px] z-20 rounded-[7px]"
          />
          <Input
            type="date"
            className="relative z-10 w-full border-[#262626] bg-[#06090d] shadow-none"
            value={day}
            onChange={(event) => setDay(event.target.value)}
            aria-label="Data da agenda"
          />
        </div>
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
        onClick={openEncaixe}
        disabled={!services?.length}
        className="group relative isolate mt-2 ml-12 flex h-[42px] w-44 items-center justify-center rounded-[15px] border-[0.75px] border-[#6d5519]/70 bg-[radial-gradient(circle_at_22%_28%,rgba(224,175,45,0.18)_0%,rgba(128,92,20,0.08)_34%,transparent_66%),linear-gradient(100deg,#0c0b08_0%,#0b0b0a_60%,#0d0c09_100%)] px-4 text-[0.82rem] font-medium tracking-[-0.01em] text-[#f5f5f5] shadow-[inset_0_1px_0_rgba(255,222,129,0.035),0_0_18px_rgba(210,157,32,0.025)] transition-all duration-200 hover:border-[#8b6a1d]/75 hover:bg-[radial-gradient(circle_at_22%_28%,rgba(224,175,45,0.22)_0%,rgba(128,92,20,0.10)_34%,transparent_66%),linear-gradient(100deg,#0d0c09_0%,#0b0b0a_60%,#0d0c09_100%)] hover:shadow-[inset_0_1px_0_rgba(255,222,129,0.05),0_0_20px_rgba(210,157,32,0.035)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className="encaixe-border-beam pointer-events-none absolute inset-[-1px] z-20 rounded-[15px]"
        />
        <span className="relative z-10">Encaixe</span>
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

      <RuntimeProfiler id="AgendaTimeline">
      <div className="mt-3 overflow-hidden rounded-md border border-border">
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
                    <div className="flex w-full items-center gap-4 rounded-md border-b border-background bg-slot-blocked px-4 py-2.5 text-slot-blocked-foreground">
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
                      className="flex w-full items-center gap-4 rounded-md border-b border-background bg-slot-free px-4 py-2.5 text-left text-slot-free-foreground transition-opacity hover:opacity-90"
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
                const signal = appointment.deposit_cents ?? 0;

                return (
                  <li key={appointment.id}>
                    <button
                      type="button"
                      onClick={() => setDetail(appointment.id)}
                      className={`grid w-full grid-cols-[4.25rem_minmax(0,1fr)_minmax(10rem,1.35fr)_4.5rem] items-center gap-x-3 rounded-md border-b border-background px-3 py-2.5 text-left transition-opacity hover:opacity-90 ${tone}`}
                    >
                      <span className="text-[13px] font-bold leading-none">
                        {timeFromIso(appointment.starts_at)}
                      </span>

                      <span className="min-w-0 text-center leading-[1.15]">
                        <span className="block truncate text-[12px] font-medium">
                          {blocked ? "Horário bloqueado" : appointment.customer_name}
                        </span>
                        {!blocked && appointment.customer_phone && (
                          <span className="mt-0.5 block truncate text-[11px] font-normal opacity-80">
                            {appointment.customer_phone}
                          </span>
                        )}
                      </span>

                      {!blocked ? (
                        <span className="min-w-0 truncate text-center text-[11px] font-medium uppercase leading-tight">
                          {(appointment.services as { name: string } | null)?.name ?? "Serviço"}
                          {price > 0 ? ` - ${formatPrice(price)}` : " - R$ 0,00"}
                        </span>
                      ) : (
                        <span />
                      )}

                      <span className="text-right text-[11px] font-medium leading-none">
                        {!blocked
                          ? AGENDA_SIGNAL_FORMATTER.format(signal / 100)
                          : ""}
                      </span>
                    </button>
                  </li>
                );
              });
            })}
          </ul>
        )}
      </div>
      </RuntimeProfiler>

      <p className="mt-4 text-right text-sm text-muted-foreground">
        {(appointments ?? []).length} agendamento(s) · {freeSlots.length} livre(s) ·{" "}
        {formatPrice(total)}
      </p>

      <RuntimeProfiler id="AgendaBookingDialogs">
      {encaixeOpen && (
      <Dialog
        open={encaixeOpen}
        onOpenChange={(value) => {
          setEncaixeOpen(value);
          if (!value) setEncaixeForm({ ...emptyForm, time: "" });
        }}
      >
        <DialogContent className="agenda-booking-dialog overflow-y-auto p-0">
          <DialogHeader className="agenda-booking-dialog-header">
            <div className="flex items-start gap-3 text-left">
              <div className="agenda-booking-dialog-icon">
                <Clock3 className="size-[1.05rem]" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[#f1f2f4]">
                  Adicionar encaixe
                </DialogTitle>
                <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                  Agende manualmente em qualquer horário do dia em {agendaDateLabel(day)}.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="agenda-booking-dialog-body">
            <div className="agenda-booking-form-section space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="agenda-booking-label" htmlFor="encaixe-time">
                    Horário
                  </Label>
                  <Input
                    id="encaixe-time"
                    type="time"
                    step={60}
                    value={encaixeForm.time}
                    onChange={(event) =>
                      setEncaixeForm({ ...encaixeForm, time: event.target.value })
                    }
                    className="agenda-booking-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="agenda-booking-label">Funcionário</Label>
                  <Select
                    value={encaixeForm.professional_id || "__agenda__"}
                    onValueChange={(value) =>
                      setEncaixeForm({
                        ...encaixeForm,
                        professional_id: value === "__agenda__" ? "" : value,
                      })
                    }
                  >
                    <SelectTrigger className="agenda-booking-input w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__agenda__">Agenda</SelectItem>
                      {encaixeProfessionals.map((professional) => (
                        <SelectItem key={professional.id} value={professional.id}>
                          {professional.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="agenda-booking-label">Serviço</Label>
                <Select
                  value={encaixeForm.service_id}
                  onValueChange={handleEncaixeServiceChange}
                >
                  <SelectTrigger className="agenda-booking-input w-full">
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {(services ?? []).map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="agenda-booking-label" htmlFor="encaixe-name">
                    Nome Cliente
                  </Label>
                  <Input
                    id="encaixe-name"
                    placeholder="Nome"
                    value={encaixeForm.customer_name}
                    onChange={(event) =>
                      setEncaixeForm({
                        ...encaixeForm,
                        customer_name: event.target.value,
                      })
                    }
                    className="agenda-booking-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="agenda-booking-label" htmlFor="encaixe-phone">
                    Número Cliente
                  </Label>
                  <Input
                    id="encaixe-phone"
                    placeholder="(DDD)(9º Dígito)0000-0000"
                    value={encaixeForm.customer_phone}
                    onChange={(event) =>
                      setEncaixeForm({
                        ...encaixeForm,
                        customer_phone: event.target.value,
                      })
                    }
                    className="agenda-booking-input"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="agenda-booking-dialog-footer">
            <Button
              variant="outline"
              className="agenda-booking-secondary-button"
              onClick={() => setEncaixeOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="agenda-booking-primary-button"
              onClick={() => createEncaixe.mutate()}
              disabled={
                !encaixeForm.time ||
                !encaixeForm.customer_name.trim() ||
                !encaixeForm.service_id ||
                createEncaixe.isPending
              }
            >
              {createEncaixe.isPending ? "Salvando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      {open && (
      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setForm(emptyForm);
        }}
      >
        <DialogContent className="agenda-booking-dialog overflow-y-auto p-0">
          <DialogHeader className="agenda-booking-dialog-header">
            <div className="flex items-start gap-3 text-left">
              <div className="agenda-booking-dialog-icon">
                <Clock3 className="size-[1.05rem]" strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-lg font-semibold tracking-[-0.025em] text-[#f1f2f4]">
                  Agendar horário
                </DialogTitle>
                <p className="mt-1 text-xs leading-relaxed text-[#686b74]">
                  Confirme o horário selecionado e preencha os dados do agendamento.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="agenda-booking-dialog-body">
            <div className="agenda-booking-form-section space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="agenda-booking-label" htmlFor="agenda-time">
                    Horário
                  </Label>
                  <Input
                    id="agenda-time"
                    type="time"
                    value={form.time}
                    readOnly
                    className="agenda-booking-input cursor-default opacity-90"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="agenda-booking-label">Funcionário</Label>
                  <Select
                    value={form.professional_id || "__agenda__"}
                    onValueChange={(value) =>
                      setForm({
                        ...form,
                        professional_id: value === "__agenda__" ? "" : value,
                      })
                    }
                  >
                    <SelectTrigger className="agenda-booking-input w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {!linkedForSelectedService.length && (
                        <SelectItem value="__agenda__">Agenda</SelectItem>
                      )}
                      {eligibleProfessionals.map((professional) => (
                        <SelectItem key={professional.id} value={professional.id}>
                          {professional.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="agenda-booking-label">Serviço</Label>
                <Select value={form.service_id} onValueChange={handleServiceChange}>
                  <SelectTrigger className="agenda-booking-input w-full">
                    <SelectValue placeholder="Selecione um serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {(services ?? []).map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="agenda-booking-label" htmlFor="agenda-name">
                    Nome Cliente
                  </Label>
                  <Input
                    id="agenda-name"
                    placeholder="Nome"
                    value={form.customer_name}
                    onChange={(event) =>
                      setForm({ ...form, customer_name: event.target.value })
                    }
                    className="agenda-booking-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="agenda-booking-label" htmlFor="agenda-phone">
                    Número Cliente
                  </Label>
                  <Input
                    id="agenda-phone"
                    placeholder="(DDD)(9º Dígito)0000-0000"
                    value={form.customer_phone}
                    onChange={(event) =>
                      setForm({ ...form, customer_phone: event.target.value })
                    }
                    className="agenda-booking-input"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="agenda-booking-dialog-footer">
            <Button
              variant="outline"
              className="agenda-booking-secondary-button"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              className="agenda-booking-primary-button"
              onClick={() => create.mutate()}
              disabled={
                !form.customer_name.trim() ||
                !form.service_id ||
                create.isPending
              }
            >
              {create.isPending ? "Salvando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      )}

      </RuntimeProfiler>

      {selected && (
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
      )}
    </div>
  );
}

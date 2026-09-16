import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { loadPanel1ConfigServer } from "@/lib/panel1-config.server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const availabilitySchema = z.object({
  slug: z.string().trim().min(1).max(120),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  professionalId: z.string().uuid().nullable().optional(),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

function minutesOf(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function hhmm(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function businessBySlug(slug: string) {
  const db = await admin();
  const normalized = slug.trim();

  if (UUID_PATTERN.test(normalized)) {
    const { data: byId } = await (db.from("businesses") as any)
      .select("id, status")
      .eq("id", normalized)
      .maybeSingle();
    if (byId) return { db, business: byId as { id: string; status: string } };
  }

  const { data, error } = await (db.from("businesses") as any)
    .select("id, status")
    .eq("slug", normalized)
    .maybeSingle();
  if (error) throw new Error("Não foi possível carregar o estabelecimento.");
  return { db, business: data as { id: string; status: string } | null };
}

export const getPublicOpenDays = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(value))
  .handler(async ({ data }) => {
    const { db, business } = await businessBySlug(data.slug);
    if (!business || business.status === "suspenso") {
      return { days: [] as { date: string; weekday: number }[] };
    }

    const config = await loadPanel1ConfigServer(db, business.id);
    const { data: hours, error } = await db
      .from("business_hours")
      .select("weekday")
      .eq("business_id", business.id);
    if (error) throw new Error("Não foi possível carregar os dias de atendimento.");

    const open = new Set((hours ?? []).map((hour) => hour.weekday));
    const days: { date: string; weekday: number }[] = [];
    const daysAhead = config.preferences.list_dates_days;

    for (let index = 1; index <= daysAhead; index += 1) {
      const candidate = new Date(Date.now() + index * 86_400_000);
      const date = candidate.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const weekday = new Date(`${date}T12:00:00-03:00`).getDay();
      if (open.has(weekday)) days.push({ date, weekday });
    }

    return { days };
  });

export const getPublicAvailability = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => availabilitySchema.parse(value))
  .handler(async ({ data }) => {
    const { db, business } = await businessBySlug(data.slug);
    if (!business) throw new Error("Estabelecimento não encontrado.");
    if (business.status === "suspenso") {
      return { slots: [] as string[], depositCents: 0 };
    }

    const config = await loadPanel1ConfigServer(db, business.id);
    const { data: service, error: serviceError } = await db
      .from("services")
      .select("id, duration_minutes, deposit_cents, active, show_service")
      .eq("id", data.serviceId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (serviceError || !service?.active || service.show_service === false) {
      throw new Error("Serviço não disponível.");
    }

    const weekday = new Date(`${data.date}T12:00:00-03:00`).getDay();
    const { data: links, error: linksError } = await db
      .from("service_professionals")
      .select("professional_id")
      .eq("business_id", business.id)
      .eq("service_id", service.id);
    if (linksError) throw new Error("Não foi possível validar os profissionais.");

    if (links?.length) {
      if (!data.professionalId || !links.some((link) => link.professional_id === data.professionalId)) {
        throw new Error("Selecione um profissional disponível.");
      }
      const { data: professional } = await db
        .from("professionals")
        .select("active, working_days")
        .eq("id", data.professionalId)
        .eq("business_id", business.id)
        .maybeSingle();
      if (!professional?.active || !(professional.working_days ?? []).includes(weekday)) {
        return { slots: [] as string[], depositCents: service.deposit_cents };
      }
    }

    const { data: hours, error: hoursError } = await db
      .from("business_hours")
      .select("starts_at, ends_at")
      .eq("business_id", business.id)
      .eq("weekday", weekday);
    if (hoursError) throw new Error("Não foi possível carregar o expediente.");
    if (!hours?.length) return { slots: [] as string[], depositCents: service.deposit_cents };

    const { data: blocks } = await db
      .from("time_blocks")
      .select("starts_at, ends_at, recurring, weekday, block_date, professional_id")
      .eq("business_id", business.id);

    const dayStart = toIso(data.date, "00:00");
    const dayEnd = toIso(data.date, "23:59");
    const { data: appointments, error: appointmentsError } = await db
      .from("appointments")
      .select("starts_at, ends_at, status, professional_id")
      .eq("business_id", business.id)
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd);
    if (appointmentsError) throw new Error("Não foi possível verificar a agenda.");

    const busy: Array<[number, number]> = [];
    for (const block of blocks ?? []) {
      const matchesDate = block.recurring
        ? block.weekday === weekday
        : block.block_date === data.date;
      const matchesProfessional =
        !block.professional_id || block.professional_id === data.professionalId;
      if (matchesDate && matchesProfessional) {
        busy.push([minutesOf(block.starts_at), minutesOf(block.ends_at)]);
      }
    }

    for (const appointment of appointments ?? []) {
      if (appointment.status === "cancelado") continue;
      if (
        data.professionalId &&
        appointment.professional_id &&
        appointment.professional_id !== data.professionalId
      ) {
        continue;
      }
      const starts = new Date(appointment.starts_at).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const ends = new Date(appointment.ends_at).toLocaleTimeString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      busy.push([minutesOf(starts), minutesOf(ends)]);
    }

    const step = config.preferences.listing_time_minutes;
    const earliest = Date.now() + config.preferences.minimum_notice_hours * 60 * 60 * 1000;
    const slots: string[] = [];

    for (const hour of hours) {
      const start = minutesOf(hour.starts_at);
      const finish = minutesOf(hour.ends_at);
      for (let minute = start; minute + service.duration_minutes <= finish; minute += step) {
        const end = minute + service.duration_minutes;
        const slot = hhmm(minute);
        if (new Date(toIso(data.date, slot)).getTime() < earliest) continue;
        if (busy.some(([busyStart, busyEnd]) => minute < busyEnd && end > busyStart)) continue;
        slots.push(slot);
      }
    }

    return { slots: [...new Set(slots)], depositCents: service.deposit_cents };
  });

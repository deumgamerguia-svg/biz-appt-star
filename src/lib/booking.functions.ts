import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  professionalId: z.string().uuid().nullable().optional(),
});

type Ctx = {
  businessId: string;
  service: { id: string; name: string; duration_minutes: number; deposit_cents: number };
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function toIso(date: string, time: string) {
  // Horários do negócio são interpretados no fuso de São Paulo (UTC-3).
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

function minutesOf(t: string) {
  const [h, m] = t.split(":");
  return Number(h) * 60 + Number(m);
}

function hhmm(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

async function loadContext(slug: string, serviceId: string): Promise<Ctx> {
  const db = await admin();
  const { data: business } = await db
    .from("businesses")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!business) throw new Error("Negócio não encontrado.");
  const { data: service } = await db
    .from("services")
    .select("id, name, duration_minutes, deposit_cents")
    .eq("id", serviceId)
    .eq("business_id", business.id)
    .eq("active", true)
    .maybeSingle();
  if (!service) throw new Error("Serviço não encontrado.");
  return { businessId: business.id, service };
}

export const getAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => slugSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { businessId, service } = await loadContext(data.slug, data.serviceId);
    const weekday = new Date(`${data.date}T12:00:00-03:00`).getDay();

    const { data: hours } = await db
      .from("business_hours")
      .select("starts_at, ends_at")
      .eq("business_id", businessId)
      .eq("weekday", weekday);
    if (!hours?.length) return { slots: [] as string[], depositCents: service.deposit_cents };

    const { data: blocks } = await db
      .from("time_blocks")
      .select("starts_at, ends_at, recurring, weekday, block_date, professional_id")
      .eq("business_id", businessId);

    const dayStart = toIso(data.date, "00:00");
    const dayEnd = toIso(data.date, "23:59");
    const { data: appts } = await db
      .from("appointments")
      .select("starts_at, ends_at, status, professional_id")
      .eq("business_id", businessId)
      .gte("starts_at", dayStart)
      .lte("starts_at", dayEnd);

    const busy: [number, number][] = [];
    for (const b of blocks ?? []) {
      const matches = b.recurring ? b.weekday === weekday : b.block_date === data.date;
      const sameProf = !b.professional_id || b.professional_id === data.professionalId;
      if (matches && sameProf)
        busy.push([minutesOf(b.starts_at.slice(0, 5)), minutesOf(b.ends_at.slice(0, 5))]);
    }
    for (const a of appts ?? []) {
      if (a.status === "cancelado" || a.status === "aguardando_sinal") continue;
      if (data.professionalId && a.professional_id && a.professional_id !== data.professionalId)
        continue;
      const s = new Date(a.starts_at);
      const e = new Date(a.ends_at);
      const off = (d: Date) =>
        Number(
          d.toLocaleTimeString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).slice(0, 2),
        ) *
          60 +
        Number(
          d
            .toLocaleTimeString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })
            .slice(3, 5),
        );
      busy.push([off(s), off(e)]);
    }

    const nowMin =
      data.date ===
      new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })
        ? (() => {
            const t = new Date().toLocaleTimeString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
            return minutesOf(t);
          })()
        : -1;

    const slots: string[] = [];
    for (const h of hours) {
      const from = minutesOf(h.starts_at.slice(0, 5));
      const to = minutesOf(h.ends_at.slice(0, 5));
      for (let t = from; t + service.duration_minutes <= to; t += 30) {
        const end = t + service.duration_minutes;
        if (t <= nowMin) continue;
        if (busy.some(([bs, be]) => t < be && end > bs)) continue;
        slots.push(hhmm(t));
      }
    }
    return { slots, depositCents: service.deposit_cents };
  });

export const createDepositBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    slugSchema
      .extend({
        time: z.string().regex(/^\d{2}:\d{2}$/),
        customerName: z.string().min(2).max(80),
        customerPhone: z.string().min(8).max(20),
        notes: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { businessId, service } = await loadContext(data.slug, data.serviceId);
    if (!service.deposit_cents || service.deposit_cents <= 0)
      throw new Error("Este serviço ainda não tem valor de sinal configurado.");

    const startsAt = toIso(data.date, data.time);
    const endsAt = new Date(
      new Date(startsAt).getTime() + service.duration_minutes * 60_000,
    ).toISOString();

    const { data: clash } = await db
      .from("appointments")
      .select("id")
      .eq("business_id", businessId)
      .lt("starts_at", endsAt)
      .gt("ends_at", startsAt)
      .not("status", "in", '("cancelado","aguardando_sinal")')
      .limit(1);
    if (clash?.length) throw new Error("Esse horário acabou de ser ocupado. Escolha outro.");

    const { data: appointment, error: apptError } = await db
      .from("appointments")
      .insert({
        business_id: businessId,
        service_id: service.id,
        professional_id: data.professionalId ?? null,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        starts_at: startsAt,
        ends_at: endsAt,
        status: "aguardando_sinal",
        deposit_cents: service.deposit_cents,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (apptError || !appointment) throw new Error(apptError?.message ?? "Falha ao reservar.");

    const { data: charge, error: chargeError } = await db
      .from("deposit_payments")
      .insert({
        business_id: businessId,
        appointment_id: appointment.id,
        amount_cents: service.deposit_cents,
        status: "pendente",
        payer_name: data.customerName,
        payer_phone: data.customerPhone,
      })
      .select("id")
      .single();
    if (chargeError || !charge) throw new Error(chargeError?.message ?? "Falha ao criar cobrança.");

    const { createPixCharge } = await import("./mercadopago.server");
    try {
      const pix = await createPixCharge({
        amountCents: service.deposit_cents,
        description: `Sinal - ${service.name}`,
        payerName: data.customerName,
        payerEmail: `sinal+${charge.id}@agendae.app`,
        externalReference: charge.id,
      });
      await db
        .from("deposit_payments")
        .update({
          provider_payment_id: pix.providerPaymentId,
          qr_code: pix.qrCode,
          qr_code_base64: pix.qrCodeBase64,
          ticket_url: pix.ticketUrl,
          expires_at: pix.expiresAt,
        })
        .eq("id", charge.id);

      return {
        chargeId: charge.id,
        amountCents: service.deposit_cents,
        qrCode: pix.qrCode,
        qrCodeBase64: pix.qrCodeBase64,
        ticketUrl: pix.ticketUrl,
        expiresAt: pix.expiresAt,
      };
    } catch (e) {
      await db.from("deposit_payments").update({ status: "cancelado" }).eq("id", charge.id);
      await db.from("appointments").delete().eq("id", appointment.id);
      throw e;
    }
  });

export const getDepositStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ chargeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: charge } = await db
      .from("deposit_payments")
      .select("id, status, provider_payment_id, appointment_id")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (!charge) throw new Error("Cobrança não encontrada.");
    if (charge.status === "pago") return { status: "pago" as const };

    if (charge.provider_payment_id) {
      const { fetchPaymentStatus } = await import("./mercadopago.server");
      const status = await fetchPaymentStatus(charge.provider_payment_id);
      if (status === "approved") {
        const paidAt = new Date().toISOString();
        await db
          .from("deposit_payments")
          .update({ status: "pago", paid_at: paidAt })
          .eq("id", charge.id);
        if (charge.appointment_id)
          await db
            .from("appointments")
            .update({ status: "agendado", deposit_paid_at: paidAt })
            .eq("id", charge.appointment_id);
        return { status: "pago" as const };
      }
      if (["cancelled", "rejected", "expired"].includes(status)) {
        await db.from("deposit_payments").update({ status: "expirado" }).eq("id", charge.id);
        if (charge.appointment_id)
          await db.from("appointments").delete().eq("id", charge.appointment_id);
        return { status: "expirado" as const };
      }
    }
    return { status: "pendente" as const };
  });

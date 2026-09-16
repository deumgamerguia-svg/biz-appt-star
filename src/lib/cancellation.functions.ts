import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type CancellationPreferences = {
  cancellations_enabled?: boolean;
  cancellation_notice_minutes?: number;
  cancellations?: boolean;
};

function cancellationLabel(minutes: number) {
  if (minutes <= 0) return "sem antecedência mínima";
  if (minutes < 60) return `${minutes} minutos`;
  if (minutes === 60) return "1 hora";
  if (minutes % 60 === 0) return `${minutes / 60} horas`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}min`;
}

export const cancelCustomerBooking = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ chargeId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: charge } = await supabaseAdmin
      .from("deposit_payments")
      .select("id, status, appointment_id, business_id")
      .eq("id", data.chargeId)
      .maybeSingle();

    if (!charge?.appointment_id) throw new Error("Agendamento não encontrado.");

    const { data: appointment } = await supabaseAdmin
      .from("appointments")
      .select("id, status, starts_at, business_id")
      .eq("id", charge.appointment_id)
      .maybeSingle();

    if (!appointment) throw new Error("Agendamento não encontrado.");
    if (appointment.status === "cancelado") return { ok: true };

    const { data: business } = await (supabaseAdmin.from("businesses") as any)
      .select("booking_preferences")
      .eq("id", appointment.business_id)
      .maybeSingle();

    const prefs = (business?.booking_preferences ?? {}) as CancellationPreferences;
    const enabled = prefs.cancellations_enabled ?? prefs.cancellations ?? true;
    const rawNotice = Number(prefs.cancellation_notice_minutes ?? 0);
    const noticeMinutes = Number.isFinite(rawNotice)
      ? Math.max(0, Math.min(960, Math.floor(rawNotice)))
      : 0;

    if (!enabled) {
      throw new Error("Este estabelecimento não permite cancelamento pelo cliente.");
    }

    const startsAtMs = new Date(appointment.starts_at).getTime();
    const nowMs = Date.now();
    if (startsAtMs <= nowMs) {
      throw new Error("Este horário já começou ou passou e não pode mais ser cancelado.");
    }

    const remainingMinutes = Math.floor((startsAtMs - nowMs) / 60_000);
    if (remainingMinutes < noticeMinutes) {
      throw new Error(
        `O cancelamento exige antecedência mínima de ${cancellationLabel(noticeMinutes)}.`,
      );
    }

    const { error: appointmentError } = await supabaseAdmin
      .from("appointments")
      .update({ status: "cancelado" })
      .eq("id", appointment.id);
    if (appointmentError) throw appointmentError;

    if (charge.status === "pendente") {
      const { error: chargeError } = await supabaseAdmin
        .from("deposit_payments")
        .update({ status: "cancelado" })
        .eq("id", charge.id);
      if (chargeError) throw chargeError;
    }

    return { ok: true };
  });

import { createFileRoute } from "@tanstack/react-router";
import {
  sendBookingExtraReminder,
  sendBookingReminder,
} from "@/lib/whatsapp-notify.server";

type BookingPreferences = {
  extra_reminder_minutes?: number;
};

export const Route = createFileRoute("/api/public/hooks/whatsapp-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.replace(/^Bearer\s+/i, "");
        const secret = process.env["CRON_SECRET"];
        if (!secret || token !== secret) {
          return Response.json({ error: "Não autorizado." }, { status: 401 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const now = new Date();
        const { data: businesses, error: bizErr } = await (supabaseAdmin.from(
          "businesses",
        ) as any)
          .select("id, reminder_hours_before, booking_preferences")
          .eq("reminder_enabled", true)
          .eq("whatsapp_status", "conectado")
          .not("whatsapp_instance", "is", null)
          .eq("status", "ativo");

        if (bizErr) {
          return Response.json({ error: bizErr.message }, { status: 500 });
        }

        let sent = 0;
        let failed = 0;
        let extraSent = 0;

        const register = async (
          businessId: string,
          appointmentId: string,
          channel: "whatsapp" | "whatsapp_extra",
          status: "enviado" | "erro",
          error?: unknown,
        ) => {
          await supabaseAdmin.from("reminder_logs").upsert(
            {
              business_id: businessId,
              appointment_id: appointmentId,
              channel,
              status,
              error:
                status === "erro"
                  ? error instanceof Error
                    ? error.message
                    : String(error)
                  : null,
            },
            { onConflict: "appointment_id,channel" },
          );
        };

        for (const biz of businesses ?? []) {
          const mainMinutes = Math.max(1, Number(biz.reminder_hours_before ?? 24)) * 60;
          const preferences = (biz.booking_preferences ?? {}) as BookingPreferences;
          const rawExtra = Number(preferences.extra_reminder_minutes ?? 0);
          const extraMinutes = Number.isFinite(rawExtra) ? Math.max(0, rawExtra) : 0;
          const maxWindowMinutes = Math.max(mainMinutes, extraMinutes);
          const windowEnd = new Date(now.getTime() + maxWindowMinutes * 60_000);

          const { data: appts } = await supabaseAdmin
            .from("appointments")
            .select("id, starts_at")
            .eq("business_id", biz.id)
            .in("status", ["agendado", "confirmado"])
            .gt("starts_at", now.toISOString())
            .lte("starts_at", windowEnd.toISOString());

          if (!appts?.length) continue;

          const ids = appts.map((a) => a.id);
          const { data: logs } = await supabaseAdmin
            .from("reminder_logs")
            .select("appointment_id, channel, status")
            .in("channel", ["whatsapp", "whatsapp_extra"])
            .in("appointment_id", ids);

          const mainAlreadySent = new Set(
            (logs ?? [])
              .filter((log) => log.channel === "whatsapp" && log.status === "enviado")
              .map((log) => log.appointment_id),
          );
          const extraAlreadySent = new Set(
            (logs ?? [])
              .filter(
                (log) => log.channel === "whatsapp_extra" && log.status === "enviado",
              )
              .map((log) => log.appointment_id),
          );

          for (const appt of appts) {
            const startsAtMs = new Date(appt.starts_at).getTime();
            const minutesUntil = (startsAtMs - now.getTime()) / 60_000;

            if (minutesUntil <= mainMinutes && !mainAlreadySent.has(appt.id)) {
              try {
                await sendBookingReminder(appt.id);
                await register(biz.id, appt.id, "whatsapp", "enviado");
                sent++;
              } catch (err) {
                failed++;
                await register(biz.id, appt.id, "whatsapp", "erro", err);
              }
            }

            if (
              extraMinutes > 0 &&
              minutesUntil <= extraMinutes &&
              !extraAlreadySent.has(appt.id)
            ) {
              try {
                await sendBookingExtraReminder(appt.id);
                await register(biz.id, appt.id, "whatsapp_extra", "enviado");
                extraSent++;
              } catch (err) {
                failed++;
                await register(biz.id, appt.id, "whatsapp_extra", "erro", err);
              }
            }
          }
        }

        return Response.json({
          ok: true,
          sent,
          extraSent,
          failed,
          businesses: businesses?.length ?? 0,
          ranAt: now.toISOString(),
        });
      },
    },
  },
});

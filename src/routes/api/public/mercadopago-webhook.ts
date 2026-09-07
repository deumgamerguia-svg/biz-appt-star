import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as
          | { type?: string; action?: string; data?: { id?: string } }
          | null;
        const paymentId = body?.data?.id;
        if (!paymentId) return new Response("ignored", { status: 200 });

        const { fetchPaymentStatus } = await import("@/lib/mercadopago.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let status: string;
        try {
          status = await fetchPaymentStatus(String(paymentId));
        } catch (e) {
          console.error("Webhook Mercado Pago:", e);
          return new Response("retry", { status: 500 });
        }

        const { data: charge } = await supabaseAdmin
          .from("deposit_payments")
          .select("id, appointment_id, status")
          .eq("provider_payment_id", String(paymentId))
          .maybeSingle();
        if (!charge) return new Response("ok", { status: 200 });

        if (status === "approved" && charge.status !== "pago") {
          const paidAt = new Date().toISOString();
          await supabaseAdmin
            .from("deposit_payments")
            .update({ status: "pago", paid_at: paidAt })
            .eq("id", charge.id);
          if (charge.appointment_id) {
            await supabaseAdmin
              .from("appointments")
              .update({ status: "agendado", deposit_paid_at: paidAt })
              .eq("id", charge.appointment_id);
            const { sendBookingConfirmation } = await import(
              "@/lib/whatsapp-notify.server"
            );
            await sendBookingConfirmation(charge.appointment_id);
          }
        } else if (["cancelled", "rejected", "expired"].includes(status)) {
          await supabaseAdmin
            .from("deposit_payments")
            .update({ status: "expirado" })
            .eq("id", charge.id);
          if (charge.appointment_id)
            await supabaseAdmin.from("appointments").delete().eq("id", charge.appointment_id);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});

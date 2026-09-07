// Envio automático de WhatsApp quando um agendamento é confirmado.
import { sendTextMessage } from "./evolution.server";

function formatDatePtBr(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatTimePtBr(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DEFAULT_MESSAGE =
  "Olá, {nome}! Seu horário de {servico} foi confirmado para {data} às {hora} em {negocio}. Até lá!";

/**
 * Envia a mensagem de confirmação para o cliente, se o negócio tiver
 * o WhatsApp conectado. Nunca lança erro para não quebrar o fluxo de pagamento.
 */
export async function sendBookingConfirmation(appointmentId: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: appt } = await supabaseAdmin
      .from("appointments")
      .select("id, business_id, customer_name, customer_phone, starts_at, service_id")
      .eq("id", appointmentId)
      .maybeSingle();
    if (!appt?.customer_phone) return;

    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("id, name, whatsapp_instance, whatsapp_status, reminder_template")
      .eq("id", appt.business_id)
      .maybeSingle();
    if (
      !business?.whatsapp_instance ||
      business.whatsapp_status !== "conectado"
    )
      return;

    let serviceName = "serviço";
    if (appt.service_id) {
      const { data: service } = await supabaseAdmin
        .from("services")
        .select("name")
        .eq("id", appt.service_id)
        .maybeSingle();
      if (service?.name) serviceName = service.name;
    }

    const message = (business.reminder_template || DEFAULT_MESSAGE)
      .replaceAll("{nome}", appt.customer_name)
      .replaceAll("{servico}", serviceName)
      .replaceAll("{data}", formatDatePtBr(appt.starts_at))
      .replaceAll("{hora}", formatTimePtBr(appt.starts_at))
      .replaceAll("{negocio}", business.name);

    await sendTextMessage(appt.customer_phone, message);
  } catch (err) {
    console.error("Falha ao enviar WhatsApp de confirmação:", err);
  }
}

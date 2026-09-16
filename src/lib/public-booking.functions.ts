import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

const serviceProfessionalsSchema = slugSchema.extend({
  serviceId: z.string().uuid(),
});

const reservationSchema = serviceProfessionalsSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  customerName: z.string().trim().min(2).max(80),
  customerPhone: z.string().trim().min(8).max(20),
  professionalId: z.string().uuid().nullable().optional(),
});

const LOGO_BUCKET = "business-logos";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;

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

async function signedStorageUrl(
  db: Awaited<ReturnType<typeof admin>>,
  path: string | null | undefined,
) {
  if (!path) return null;
  const { data, error } = await db.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * Dados necessários para montar o Painel 1.
 *
 * A leitura acontece no servidor com service role para que a página pública não
 * dependa de policies anon/RLS estarem sincronizadas no navegador. Só campos
 * próprios para exibição pública são devolvidos ao cliente.
 */
export const getPublicBookingPage = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => slugSchema.parse(value))
  .handler(async ({ data }) => {
    const db = await admin();

    const { data: business, error: businessError } = await (db.from("businesses") as any)
      .select(
        "id, name, category, phone, address, logo_url, status, brand_primary, brand_background, booking_preferences",
      )
      .eq("slug", data.slug)
      .maybeSingle();

    if (businessError) {
      throw new Error(`Não foi possível carregar o estabelecimento: ${businessError.message}`);
    }

    if (!business) {
      return {
        business: null,
        services: [],
        hiddenServices: 0,
      };
    }

    const { data: serviceRows, error: servicesError } = await db
      .from("services")
      .select(
        "id, name, duration_minutes, price_cents, deposit_cents, description, image_path, show_price, show_duration, show_service, is_combo, active, created_at",
      )
      .eq("business_id", business.id)
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (servicesError) {
      throw new Error(`Não foi possível carregar os serviços: ${servicesError.message}`);
    }

    const activeServices = serviceRows ?? [];
    const visibleServices = activeServices.filter((service) => service.show_service !== false);

    const [logoUrl, services] = await Promise.all([
      signedStorageUrl(db, business.logo_url),
      Promise.all(
        visibleServices.map(async (service) => ({
          id: service.id,
          name: service.name,
          duration_minutes: service.duration_minutes,
          price_cents: service.price_cents,
          deposit_cents: service.deposit_cents,
          description: service.description,
          show_price: service.show_price,
          show_duration: service.show_duration,
          is_combo: service.is_combo,
          image_url: await signedStorageUrl(db, service.image_path),
        })),
      ),
    ]);

    return {
      business: {
        id: business.id as string,
        name: business.name as string,
        category: (business.category ?? null) as string | null,
        phone: (business.phone ?? null) as string | null,
        address: (business.address ?? null) as string | null,
        status: business.status as string,
        brand_primary: (business.brand_primary ?? null) as string | null,
        brand_background: (business.brand_background ?? null) as string | null,
        booking_preferences: business.booking_preferences ?? null,
        logo_url: logoUrl,
      },
      services,
      hiddenServices: activeServices.length - visibleServices.length,
    };
  });

/** Profissionais vinculados ao serviço selecionado no Painel 2. */
export const getPublicServiceProfessionals = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => serviceProfessionalsSchema.parse(value))
  .handler(async ({ data }) => {
    const db = await admin();

    const { data: business } = await (db.from("businesses") as any)
      .select("id, status")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!business || business.status === "suspenso") {
      return { professionals: [] as { id: string; name: string; role: string | null }[] };
    }

    const { data: service } = await db
      .from("services")
      .select("id")
      .eq("id", data.serviceId)
      .eq("business_id", business.id)
      .eq("active", true)
      .maybeSingle();

    if (!service) {
      return { professionals: [] as { id: string; name: string; role: string | null }[] };
    }

    const { data: links, error: linksError } = await db
      .from("service_professionals")
      .select("professional_id")
      .eq("business_id", business.id)
      .eq("service_id", data.serviceId);

    if (linksError) {
      throw new Error(`Não foi possível carregar os vínculos do serviço: ${linksError.message}`);
    }

    if (!links?.length) {
      return { professionals: [] as { id: string; name: string; role: string | null }[] };
    }

    const { data: professionals, error: professionalsError } = await db
      .from("professionals")
      .select("id, name, role")
      .eq("business_id", business.id)
      .eq("active", true)
      .in(
        "id",
        links.map((link) => link.professional_id),
      )
      .order("name");

    if (professionalsError) {
      throw new Error(`Não foi possível carregar os profissionais: ${professionalsError.message}`);
    }

    return {
      professionals: (professionals ?? []).map((professional) => ({
        id: professional.id,
        name: professional.name,
        role: professional.role,
      })),
    };
  });

/**
 * Reserva definitiva do Painel 1. Revalida expediente, bloqueios, profissional e
 * conflitos no servidor para impedir que um horário inválido seja gravado por
 * estado antigo do navegador ou por duas pessoas ao mesmo tempo.
 */
export const reservePublicBooking = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => reservationSchema.parse(value))
  .handler(async ({ data }) => {
    const db = await admin();

    const { data: business } = await (db.from("businesses") as any)
      .select("id, status, booking_preferences")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!business) throw new Error("Estabelecimento não encontrado.");
    if (business.status === "suspenso") {
      throw new Error("Os agendamentos deste estabelecimento estão temporariamente indisponíveis.");
    }

    const { data: service } = await db
      .from("services")
      .select("id, name, duration_minutes, deposit_cents, active, show_service")
      .eq("id", data.serviceId)
      .eq("business_id", business.id)
      .maybeSingle();
    if (!service?.active || service.show_service === false) {
      throw new Error("Este serviço não está disponível para agendamento.");
    }

    const weekday = new Date(`${data.date}T12:00:00-03:00`).getDay();
    const { data: links, error: linkError } = await db
      .from("service_professionals")
      .select("professional_id")
      .eq("business_id", business.id)
      .eq("service_id", service.id);
    if (linkError) throw linkError;

    let selectedProfessional: { id: string; working_days: number[] } | null = null;
    if (links?.length) {
      if (!data.professionalId) throw new Error("Selecione um profissional disponível.");
      if (!links.some((link) => link.professional_id === data.professionalId)) {
        throw new Error("Este profissional não atende o serviço selecionado.");
      }
      const { data: professional } = await db
        .from("professionals")
        .select("id, active, working_days")
        .eq("id", data.professionalId)
        .eq("business_id", business.id)
        .maybeSingle();
      if (!professional?.active) throw new Error("Este profissional não está disponível.");
      selectedProfessional = {
        id: professional.id,
        working_days: professional.working_days ?? [],
      };
      if (!selectedProfessional.working_days.includes(weekday)) {
        throw new Error("O profissional selecionado não atende nesta data.");
      }
    } else if (data.professionalId) {
      throw new Error("Este serviço não possui vínculo com o profissional selecionado.");
    }

    const { data: hours } = await db
      .from("business_hours")
      .select("starts_at, ends_at")
      .eq("business_id", business.id)
      .eq("weekday", weekday);
    if (!hours?.length) throw new Error("O estabelecimento não atende nesta data.");

    const startMinute = minutesOf(data.time);
    const endMinute = startMinute + service.duration_minutes;
    const fitsWorkingHours = hours.some(
      (hour) =>
        startMinute >= minutesOf(hour.starts_at) && endMinute <= minutesOf(hour.ends_at),
    );
    if (!fitsWorkingHours) throw new Error("O horário escolhido está fora do expediente.");

    const rawNotice = Number(business.booking_preferences?.minimum_notice_hours);
    const minimumNoticeHours = Number.isFinite(rawNotice)
      ? Math.max(0, Math.min(720, rawNotice))
      : 2;
    const startsAt = toIso(data.date, data.time);
    if (new Date(startsAt).getTime() < Date.now() + minimumNoticeHours * 60 * 60 * 1000) {
      const label = minimumNoticeHours === 1 ? "1 hora" : `${minimumNoticeHours} horas`;
      throw new Error(`Este horário exige antecedência mínima de ${label}. Escolha outro horário.`);
    }
    const endsAt = new Date(
      new Date(startsAt).getTime() + service.duration_minutes * 60_000,
    ).toISOString();

    const { data: blocks } = await db
      .from("time_blocks")
      .select("starts_at, ends_at, recurring, weekday, block_date, professional_id")
      .eq("business_id", business.id);
    const hasBlock = (blocks ?? []).some((block) => {
      const matchesDate = block.recurring ? block.weekday === weekday : block.block_date === data.date;
      if (!matchesDate) return false;
      const appliesToProfessional =
        !block.professional_id || block.professional_id === data.professionalId;
      if (!appliesToProfessional) return false;
      return (
        startMinute < minutesOf(block.ends_at) && endMinute > minutesOf(block.starts_at)
      );
    });
    if (hasBlock) throw new Error("Este horário foi bloqueado. Escolha outro horário.");

    let clashQuery = db
      .from("appointments")
      .select("id")
      .eq("business_id", business.id)
      .lt("starts_at", endsAt)
      .gt("ends_at", startsAt)
      .not("status", "in", '("cancelado","aguardando_sinal")');
    if (selectedProfessional) {
      clashQuery = clashQuery.eq("professional_id", selectedProfessional.id);
    }
    const { data: clash, error: clashError } = await clashQuery.limit(1);
    if (clashError) throw clashError;
    if (clash?.length) throw new Error("Esse horário acabou de ser ocupado. Escolha outro.");

    const paymentRequired = service.deposit_cents > 0;
    const { data: appointment, error: appointmentError } = await db
      .from("appointments")
      .insert({
        business_id: business.id,
        service_id: service.id,
        professional_id: selectedProfessional?.id ?? null,
        customer_name: data.customerName,
        customer_phone: data.customerPhone,
        starts_at: startsAt,
        ends_at: endsAt,
        status: paymentRequired ? "aguardando_sinal" : "agendado",
        deposit_cents: service.deposit_cents,
      })
      .select("id")
      .single();
    if (appointmentError || !appointment) {
      throw new Error(appointmentError?.message ?? "Não foi possível registrar o agendamento.");
    }

    const now = new Date();
    const expiresAt = paymentRequired
      ? new Date(now.getTime() + 5 * 60_000).toISOString()
      : null;
    const { data: charge, error: chargeError } = await db
      .from("deposit_payments")
      .insert({
        business_id: business.id,
        appointment_id: appointment.id,
        amount_cents: service.deposit_cents,
        status: paymentRequired ? "pendente" : "pago",
        payer_name: data.customerName,
        payer_phone: data.customerPhone,
        expires_at: expiresAt,
        paid_at: paymentRequired ? null : now.toISOString(),
      })
      .select("id")
      .single();

    if (chargeError || !charge) {
      await db.from("appointments").delete().eq("id", appointment.id);
      throw new Error(chargeError?.message ?? "Não foi possível finalizar o agendamento.");
    }

    return {
      chargeId: charge.id,
      appointmentId: appointment.id,
      amountCents: service.deposit_cents,
      serviceName: service.name,
      startsAt,
      expiresAt,
      paymentRequired,
    };
  });

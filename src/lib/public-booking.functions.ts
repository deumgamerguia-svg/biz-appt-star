import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { loadPanel1ConfigServer } from "@/lib/panel1-config.server";

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
const FALLBACK_SUPABASE_URL = "https://qagotnmdqjoodoudcikd.supabase.co";
const FALLBACK_PUBLISHABLE_KEY = "sb_publishable_ahOK_X2idzT_9V00g-guZQ_FZ_eScZj";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PublicBusiness = {
  id: string;
  name: string;
  category: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  status: string;
  brand_primary: string | null;
  brand_background: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function isOpaqueSupabaseKey(value: string) {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createApiKeyFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isOpaqueSupabaseKey(apiKey) && headers.get("Authorization") === `Bearer ${apiKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", apiKey);
    return fetch(input, { ...init, headers });
  };
}

let publicClient: SupabaseClient<Database> | undefined;
function publicDb() {
  if (publicClient) return publicClient;

  // A página pública deve consultar o mesmo projeto usado no build do frontend.
  // Não damos preferência a SUPABASE_URL genérico porque hosts externos podem
  // injetar essa variável apontando para outro projeto.
  const url = process.env["VITE_SUPABASE_URL"] || FALLBACK_SUPABASE_URL;
  const key = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || FALLBACK_PUBLISHABLE_KEY;

  publicClient = createClient<Database>(url, key, {
    global: { fetch: createApiKeyFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  return publicClient;
}

async function findBusiness(
  db: SupabaseClient<Database>,
  slug: string,
): Promise<{ data: PublicBusiness | null; error: { message: string } | null }> {
  const select =
    "id, name, category, phone, address, logo_url, status, brand_primary, brand_background";
  const normalized = slug.trim();

  if (UUID_PATTERN.test(normalized)) {
    const byId = await (db.from("businesses") as any)
      .select(select)
      .eq("id", normalized)
      .maybeSingle();
    if (!byId.error && byId.data) {
      return { data: byId.data as PublicBusiness, error: null };
    }
  }

  const result = await (db.from("businesses") as any)
    .select(select)
    .eq("slug", normalized)
    .maybeSingle();
  return {
    data: (result.data as PublicBusiness | null) ?? null,
    error: result.error ? { message: result.error.message } : null,
  };
}

async function loadBusinessBySlug(slug: string): Promise<{
  db: SupabaseClient<Database>;
  business: PublicBusiness | null;
}> {
  let privilegedFailure: string | null = null;

  // Fonte principal: leitura server-side. Assim o Painel 1 não depende de RLS
  // anon para localizar um estabelecimento que já existe no Painel 2.
  try {
    const privileged = (await admin()) as SupabaseClient<Database>;
    const result = await findBusiness(privileged, slug);
    if (!result.error && result.data) {
      return { db: privileged, business: result.data };
    }
    privilegedFailure = result.error?.message ?? null;
  } catch (error) {
    privilegedFailure = error instanceof Error ? error.message : "Falha no acesso do servidor";
  }

  // Fallback sem segredo: funciona quando as policies públicas estiverem ativas.
  const fallback = publicDb();
  const result = await findBusiness(fallback, slug);
  if (result.error) {
    throw new Error("Não foi possível carregar o estabelecimento. Tente novamente.");
  }
  if (!result.data && privilegedFailure) {
    throw new Error("Não foi possível acessar os dados do agendamento. Tente novamente em instantes.");
  }
  return { db: fallback, business: result.data };
}

function toIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

function minutesOf(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

async function signedStorageUrl(
  db: SupabaseClient<Database>,
  path: string | null | undefined,
) {
  if (!path) return null;
  const { data, error } = await db.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Catálogo público do Painel 1. */
export const getPublicBookingPage = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => slugSchema.parse(value))
  .handler(async ({ data }) => {
    const { db, business } = await loadBusinessBySlug(data.slug);

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
      throw new Error("Não foi possível carregar os serviços. Tente novamente.");
    }

    const activeServices = serviceRows ?? [];
    const visibleServices = activeServices.filter((service) => service.show_service !== false);
    const config = await loadPanel1ConfigServer(db, business.id);

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
        id: business.id,
        name: business.name,
        category: business.category,
        phone: business.phone,
        address: business.address,
        status: business.status,
        brand_primary: business.brand_primary,
        brand_background: business.brand_background,
        booking_preferences: config.preferences,
        booking_appearance: config.appearance,
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
    const { db, business } = await loadBusinessBySlug(data.slug);

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
      throw new Error("Não foi possível carregar os profissionais deste serviço.");
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
      throw new Error("Não foi possível carregar os profissionais deste serviço.");
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
 * Reserva definitiva do Painel 1. Revalida expediente, bloqueios, profissional,
 * preferências e conflitos no servidor antes de gravar.
 */
export const reservePublicBooking = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => reservationSchema.parse(value))
  .handler(async ({ data }) => {
    const db = (await admin()) as SupabaseClient<Database>;
    const businessResult = await findBusiness(db, data.slug);
    if (businessResult.error) throw new Error("Não foi possível validar o estabelecimento.");
    const business = businessResult.data;
    if (!business) throw new Error("Estabelecimento não encontrado.");
    if (business.status === "suspenso") {
      throw new Error("Os agendamentos deste estabelecimento estão temporariamente indisponíveis.");
    }

    const config = await loadPanel1ConfigServer(db, business.id);

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

    const startsAt = toIso(data.date, data.time);
    const minimumNoticeHours = config.preferences.minimum_notice_hours;
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
      return startMinute < minutesOf(block.ends_at) && endMinute > minutesOf(block.starts_at);
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

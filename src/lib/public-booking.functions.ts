import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slugSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

const serviceProfessionalsSchema = slugSchema.extend({
  serviceId: z.string().uuid(),
});

const LOGO_BUCKET = "business-logos";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 6;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
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

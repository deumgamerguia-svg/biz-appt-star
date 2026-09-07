import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const phoneLogin = (phone: string) => `${onlyDigits(phone)}@agenda.local`;
const phonePassword = (senha: string) => `agendae:${senha}`;

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito ao painel master.");
  return supabaseAdmin;
}

/** Informa se o usuário atual é master e se a plataforma já tem um master. */
export const getMasterStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    if (error) throw new Error(error.message);
    const admins = data ?? [];
    return {
      isMaster: admins.some((a) => a.user_id === context.userId),
      hasMaster: admins.length > 0,
    };
  });

/** Primeiro acesso: quando ainda não existe master, o usuário logado assume o posto. */
export const claimMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("role", "super_admin")
      .limit(1);
    if (error) throw new Error(error.message);
    if ((data ?? []).length) throw new Error("A plataforma já possui um master.");
    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "super_admin" });
    if (insertError) throw new Error(insertError.message);
    return { ok: true };
  });

/** Lista todos os estabelecimentos com contagem de agendamentos. */
export const listAllBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("businesses")
      .select("id, name, slug, category, phone, owner_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const businesses = data ?? [];

    const { data: owners } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email");

    const { data: appts } = await supabaseAdmin.from("appointments").select("business_id");
    const counts = new Map<string, number>();
    for (const a of appts ?? []) {
      counts.set(a.business_id, (counts.get(a.business_id) ?? 0) + 1);
    }

    return businesses.map((b) => {
      const owner = (owners ?? []).find((o) => o.id === b.owner_id);
      return {
        ...b,
        owner_name: owner?.full_name ?? null,
        owner_login: owner?.email ?? null,
        appointments: counts.get(b.id) ?? 0,
      };
    });
  });

const createInput = z.object({
  businessName: z.string().min(2),
  category: z.string().min(1),
  ownerName: z.string().min(2),
  phone: z.string().min(10),
  password: z.string().min(4),
});

/** Cria o acesso do dono (telefone + senha) e o estabelecimento dele. */
export const createBusinessWithOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createInput.parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const digits = onlyDigits(data.phone);
    const email = phoneLogin(digits);

    let ownerId: string | null = null;
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: phonePassword(data.password),
      email_confirm: true,
      user_metadata: { full_name: data.ownerName, phone: digits },
    });

    if (created.error) {
      const { data: existing } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (!existing) throw new Error(created.error.message);
      ownerId = existing.id;
      await supabaseAdmin.auth.admin.updateUserById(ownerId, {
        password: phonePassword(data.password),
      });
    } else {
      ownerId = created.data.user?.id ?? null;
    }

    if (!ownerId) throw new Error("Não foi possível criar o acesso do dono.");

    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: ownerId, role: "owner" }, { onConflict: "user_id,role" });

    const base = data.businessName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40);
    const slug = `${base || "negocio"}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .insert({
        name: data.businessName,
        slug,
        category: data.category,
        phone: digits,
        owner_id: ownerId,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

    return { businessId: business.id, slug: business.slug, phone: digits };
  });

/** Remove um estabelecimento da plataforma. */
export const deleteBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("businesses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

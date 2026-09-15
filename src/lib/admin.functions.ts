import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const onlyDigits = (value: string) => value.replace(/\D/g, "");
const phoneLogin = (phone: string) => `${onlyDigits(phone)}@agenda.local`;
const phonePassword = (senha: string) => `agendaagora:${senha}`;

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

/** Verifica exclusivamente se a sessão atual pertence ao responsável master. */
export const getMasterStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { isMaster: !!data };
  });

/** Lista todos os estabelecimentos com contagem de agendamentos. */
export const listAllBusinesses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("businesses")
      .select(
        "id, name, slug, category, phone, owner_id, created_at, status, monthly_fee_cents",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const businesses = data ?? [];

    const { data: owners } = await supabaseAdmin.from("profiles").select("id, full_name, email");
    const { data: appts } = await supabaseAdmin.from("appointments").select("business_id");
    const counts = new Map<string, number>();
    for (const a of appts ?? []) counts.set(a.business_id, (counts.get(a.business_id) ?? 0) + 1);

    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: payments } = await supabaseAdmin
      .from("subscription_payments")
      .select("business_id, status, reference_month");

    return businesses.map((b) => {
      const owner = (owners ?? []).find((o) => o.id === b.owner_id);
      const monthPayment = (payments ?? []).find(
        (p) => p.business_id === b.id && p.reference_month.slice(0, 7) === currentMonth,
      );
      return {
        ...b,
        owner_name: owner?.full_name ?? null,
        owner_login: owner?.email ?? null,
        appointments: counts.get(b.id) ?? 0,
        current_month_status: monthPayment?.status ?? "pendente",
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
      const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
      if (!existing) throw new Error(created.error.message);
      ownerId = existing.id;
      await supabaseAdmin.auth.admin.updateUserById(ownerId, { password: phonePassword(data.password) });
    } else ownerId = created.data.user?.id ?? null;

    if (!ownerId) throw new Error("Não foi possível criar o acesso do dono.");
    await supabaseAdmin.from("user_roles").upsert({ user_id: ownerId, role: "owner" }, { onConflict: "user_id,role" });

    const base = data.businessName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
    const slug = `${base || "negocio"}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: business, error } = await supabaseAdmin
      .from("businesses")
      .insert({ name: data.businessName, slug, category: data.category, phone: digits, owner_id: ownerId })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return { businessId: business.id, slug: business.slug, phone: digits };
  });

export const deleteBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("businesses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setBusinessStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["ativo", "suspenso"]) }).parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("businesses").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMonthlyFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), amountCents: z.number().int().min(0) }).parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const { error } = await supabaseAdmin.from("businesses").update({ monthly_fee_cents: data.amountCents }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const monthRegex = /^\d{4}-\d{2}$/;

export const registerSubscriptionCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ businessId: z.string().uuid(), month: z.string().regex(monthRegex), status: z.enum(["pago", "pendente"]) }).parse(data))
  .handler(async ({ context, data }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const { data: business, error: bErr } = await supabaseAdmin.from("businesses").select("monthly_fee_cents").eq("id", data.businessId).maybeSingle();
    if (bErr) throw new Error(bErr.message);
    if (!business) throw new Error("Estabelecimento não encontrado.");
    const referenceMonth = `${data.month}-01`;
    const { data: existing } = await supabaseAdmin.from("subscription_payments").select("id").eq("business_id", data.businessId).eq("reference_month", referenceMonth).maybeSingle();
    const payload = { business_id: data.businessId, reference_month: referenceMonth, amount_cents: business.monthly_fee_cents ?? 8990, status: data.status, paid_at: data.status === "pago" ? new Date().toISOString() : null };
    const { error } = existing ? await supabaseAdmin.from("subscription_payments").update(payload).eq("id", existing.id) : await supabaseAdmin.from("subscription_payments").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPlatformMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertSuperAdmin(context.userId);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: businesses, error } = await supabaseAdmin.from("businesses").select("id, status, monthly_fee_cents");
    if (error) throw new Error(error.message);
    const list = businesses ?? [];
    const active = list.filter((b) => b.status !== "suspenso");
    const { data: payments } = await supabaseAdmin.from("subscription_payments").select("business_id, amount_cents, status, reference_month");
    const paidThisMonth = (payments ?? []).filter((p) => p.status === "pago" && p.reference_month.slice(0, 7) === currentMonth);
    const revenueTotal = (payments ?? []).filter((p) => p.status === "pago").reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
    const { data: deposits } = await supabaseAdmin.from("deposit_payments").select("amount_cents, status");
    const depositsTotal = (deposits ?? []).filter((d) => d.status === "pago" || d.status === "aprovado").reduce((sum, d) => sum + (d.amount_cents ?? 0), 0);
    const { count: appointmentsCount } = await supabaseAdmin.from("appointments").select("id", { count: "exact", head: true });
    return { currentMonth, totalBusinesses: list.length, activeBusinesses: active.length, suspendedBusinesses: list.length - active.length, mrrCents: active.reduce((sum, b) => sum + (b.monthly_fee_cents ?? 0), 0), paidThisMonthCount: paidThisMonth.length, paidThisMonthCents: paidThisMonth.reduce((s, p) => s + (p.amount_cents ?? 0), 0), delinquentCount: active.length - paidThisMonth.length, revenueTotalCents: revenueTotal, depositsTotalCents: depositsTotal, appointments: appointmentsCount ?? 0 };
  });

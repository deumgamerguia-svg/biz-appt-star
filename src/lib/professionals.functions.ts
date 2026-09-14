import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const permissionsSchema = z.record(z.string(), z.boolean());
const inputSchema = z.object({
  id: z.string().uuid().optional(),
  businessId: z.string().uuid(),
  name: z.string().min(2).max(80),
  role: z.string().max(80).optional(),
  phone: z.string().max(20).default(""),
  email: z.string().email().or(z.literal("")).default(""),
  password: z.string().regex(/^\d{4}$/).optional().or(z.literal("")),
  avatarPath: z.string().nullable().optional(),
  workingDays: z.array(z.number().int().min(0).max(6)),
  permissions: permissionsSchema,
  serviceIds: z.array(z.string().uuid()),
});

const digits = (value: string) => value.replace(/\D/g, "");
const passwordValue = (value: string) => `agendaagora:${value}`;

export const saveProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: business } = await context.supabase
      .from("businesses")
      .select("id")
      .eq("id", data.businessId)
      .maybeSingle();
    if (!business) throw new Error("Somente o dono pode gerenciar acessos da equipe.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const loginEmail = data.email.trim().toLowerCase() || `${digits(data.phone)}@agenda.local`;
    let userId: string | null = null;

    if (data.id) {
      const { data: current } = await supabaseAdmin
        .from("professionals")
        .select("user_id")
        .eq("id", data.id)
        .eq("business_id", data.businessId)
        .maybeSingle();
      userId = current?.user_id ?? null;
      if (userId) {
        const update: { email?: string; password?: string; user_metadata: Record<string, string> } = {
          email: loginEmail,
          user_metadata: { full_name: data.name, phone: digits(data.phone) },
        };
        if (data.password) update.password = passwordValue(data.password);
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, update);
        if (error) throw new Error(error.message);
      }
    }

    if (!userId) {
      if (!data.password) throw new Error("Informe uma senha de quatro dígitos.");
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: loginEmail,
        password: passwordValue(data.password),
        email_confirm: true,
        user_metadata: { full_name: data.name, phone: digits(data.phone) },
      });
      if (error || !created.user) throw new Error(error?.message ?? "Não foi possível criar o acesso.");
      userId = created.user.id;
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: "professional" },
        { onConflict: "user_id,role" },
      );
    }

    const payload = {
      business_id: data.businessId,
      user_id: userId,
      name: data.name,
      role: data.role || null,
      phone: digits(data.phone) || null,
      email: data.email || null,
      avatar_path: data.avatarPath ?? null,
      working_days: data.workingDays,
      permissions: data.permissions,
    };
    const query = data.id
      ? supabaseAdmin.from("professionals").update(payload).eq("id", data.id).eq("business_id", data.businessId).select("id").single()
      : supabaseAdmin.from("professionals").insert(payload).select("id").single();
    const { data: professional, error: saveError } = await query;
    if (saveError) throw new Error(saveError.message);

    await supabaseAdmin.from("service_professionals").delete().eq("professional_id", professional.id);
    if (data.serviceIds.length) {
      const { error: linkError } = await supabaseAdmin.from("service_professionals").insert(
        data.serviceIds.map((serviceId) => ({
          business_id: data.businessId,
          professional_id: professional.id,
          service_id: serviceId,
        })),
      );
      if (linkError) throw new Error(linkError.message);
    }
    return { id: professional.id };
  });

export const deleteProfessional = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid(), businessId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: business } = await context.supabase.from("businesses").select("id").eq("id", data.businessId).maybeSingle();
    if (!business) throw new Error("Somente o dono pode remover acessos da equipe.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: professional } = await supabaseAdmin.from("professionals").select("user_id").eq("id", data.id).eq("business_id", data.businessId).maybeSingle();
    const { error } = await supabaseAdmin.from("professionals").delete().eq("id", data.id).eq("business_id", data.businessId);
    if (error) throw new Error(error.message);
    if (professional?.user_id) await supabaseAdmin.auth.admin.deleteUser(professional.user_id);
    return { ok: true };
  });
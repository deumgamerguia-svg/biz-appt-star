import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const accessTokenInput = z.string().min(20);
const digits = (value: string) => value.replace(/\D/g, "");
const phoneLogin = (phone: string) => `${digits(phone)}@agenda.local`;
const phonePassword = (password: string) => `agendaagora:${password}`;

async function requireMaster(accessToken: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) throw new Error("Sessão Master inválida.");

  const { data: role, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "super_admin")
    .maybeSingle();
  if (roleError) throw new Error(roleError.message);
  if (!role) throw new Error("Acesso restrito ao painel Master.");
  return supabaseAdmin;
}

export const updateBusinessOwnerAccess = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) =>
    z
      .object({
        accessToken: accessTokenInput,
        businessId: z.string().uuid(),
        ownerName: z.string().trim().min(2).max(80),
        phone: z.string().min(10).max(30),
        password: z.string().regex(/^\d{4}$/).optional().or(z.literal("")),
      })
      .parse(value),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await requireMaster(data.accessToken);
    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("id, owner_id")
      .eq("id", data.businessId)
      .maybeSingle();
    if (businessError) throw new Error(businessError.message);
    if (!business?.owner_id) throw new Error("Dono do estabelecimento não encontrado.");

    const phone = digits(data.phone);
    if (phone.length < 10) throw new Error("Informe um telefone válido.");
    const email = phoneLogin(phone);
    const authUpdate: {
      email: string;
      user_metadata: Record<string, string>;
      password?: string;
    } = {
      email,
      user_metadata: { full_name: data.ownerName.trim(), phone },
    };
    if (data.password) authUpdate.password = phonePassword(data.password);

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      business.owner_id,
      authUpdate,
    );
    if (authError) throw new Error(authError.message);

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.ownerName.trim(), email })
      .eq("id", business.owner_id);
    if (profileError) throw new Error(profileError.message);

    await supabaseAdmin
      .from("businesses")
      .update({ phone })
      .eq("id", business.id);

    return { ok: true, phone };
  });

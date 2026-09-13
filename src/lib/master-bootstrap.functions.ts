import { createServerFn } from "@tanstack/react-start";

const MASTER_EMAIL = "guiagencyy@gmail.com";
const MASTER_PASSWORD = "agendaai:1237";

/** Bootstrap único do acesso master (idempotente). */
export const bootstrapMaster = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let userId: string | null = null;
  const created = await supabaseAdmin.auth.admin.createUser({
    email: MASTER_EMAIL,
    password: MASTER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Master" },
  });

  if (created.error) {
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", MASTER_EMAIL)
      .maybeSingle();
    if (!existing) throw new Error(created.error.message);
    userId = existing.id;
    await supabaseAdmin.auth.admin.updateUserById(userId, { password: MASTER_PASSWORD });
  } else {
    userId = created.data.user?.id ?? null;
  }

  if (!userId) throw new Error("Não foi possível criar o acesso master.");

  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "super_admin" }, { onConflict: "user_id,role" });

  return { ok: true, userId };
});

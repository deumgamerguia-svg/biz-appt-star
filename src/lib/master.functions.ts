import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({ code: z.string().regex(/^\d{8}$/), password: z.string().regex(/^\d{8}$/) });

export const masterLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }) => {
    const expected = process.env["AGENDA_MASTER_CODE"];
    if (!expected || data.code !== expected || data.password !== expected) throw new Error("Código ou senha Master inválidos.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const masterEmail = `${data.code}@agenda.local`;
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw new Error(usersError.message);
    let masterUser = users.users.find((user) => user.email?.toLowerCase() === masterEmail.toLowerCase());
    if (!masterUser) {
      const created = await supabaseAdmin.auth.admin.createUser({ email: masterEmail, password: data.password, email_confirm: true, user_metadata: { full_name: "Master Agenda Agora", master_access: true } });
      if (created.error || !created.data.user) throw new Error(created.error?.message ?? "Não foi possível criar o acesso Master.");
      masterUser = created.data.user;
    } else {
      const updated = await supabaseAdmin.auth.admin.updateUserById(masterUser.id, { password: data.password, email_confirm: true });
      if (updated.error) throw new Error(updated.error.message);
    }
    const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({ user_id: masterUser.id, role: "super_admin" }, { onConflict: "user_id,role" });
    if (roleError) throw new Error(roleError.message);
    const { data: session, error: sessionError } = await supabaseAdmin.auth.signInWithPassword({ email: masterEmail, password: data.password });
    if (sessionError || !session.session) throw new Error(sessionError?.message ?? "Não foi possível iniciar a sessão Master.");
    return { access_token: session.session.access_token, refresh_token: session.session.refresh_token };
  });

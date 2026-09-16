import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { LOGO_BUCKET } from "@/lib/logo";
import {
  defaultPanel1Config,
  normalizePanel1Config,
  panel1SettingsPath,
  type Panel1Config,
} from "@/lib/panel1-config";

export async function loadPanel1ConfigServer(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<Panel1Config> {
  const { data, error } = await db.storage
    .from(LOGO_BUCKET)
    .download(panel1SettingsPath(businessId));

  if (error || !data) return defaultPanel1Config();

  try {
    return normalizePanel1Config(JSON.parse(await data.text()));
  } catch {
    return defaultPanel1Config();
  }
}

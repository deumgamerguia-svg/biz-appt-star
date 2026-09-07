import { supabase } from "@/integrations/supabase/client";

export const LOGO_BUCKET = "business-logos";

export async function getLogoUrl(path: string | null | undefined) {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(LOGO_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24);
  if (error) return null;
  return data?.signedUrl ?? null;
}

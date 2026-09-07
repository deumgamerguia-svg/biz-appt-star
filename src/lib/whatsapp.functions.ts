import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const bizSchema = z.object({ businessId: z.string().uuid() });

type BizRow = {
  id: string;
  name: string;
  whatsapp_instance: string | null;
  whatsapp_status: string;
};

async function loadOwnedBusiness(
  supabase: any,
  businessId: string,
): Promise<BizRow> {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, whatsapp_instance, whatsapp_status")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Negócio não encontrado.");
  return data as BizRow;
}

function instanceName(businessId: string) {
  return `agendae-${businessId.slice(0, 8)}`;
}

/** Inicia a conexão: cria a instância na Evolution API e devolve o QR Code. */
export const connectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bizSchema.parse(d))
  .handler(async ({ context, data }) => {
    const evo = await import("./evolution.server");
    const business = await loadOwnedBusiness(context.supabase, data.businessId);
    const instance = business.whatsapp_instance ?? instanceName(business.id);

    let qr: { qrcode?: string; code?: string } = {};
    try {
      qr = await evo.createInstance(instance);
    } catch {
      // Instância pode já existir: tenta só pegar o QR Code.
      qr = await evo.getQrCode(instance);
    }

    await context.supabase
      .from("businesses")
      .update({ whatsapp_instance: instance, whatsapp_status: "conectando" })
      .eq("id", business.id);

    return { instance, qrCode: qr.qrcode ?? null, pairingCode: qr.code ?? null };
  });

/** Gera um novo QR Code para uma instância já criada. */
export const refreshWhatsappQr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bizSchema.parse(d))
  .handler(async ({ context, data }) => {
    const evo = await import("./evolution.server");
    const business = await loadOwnedBusiness(context.supabase, data.businessId);
    if (!business.whatsapp_instance)
      throw new Error("Inicie a conexão primeiro.");
    const qr = await evo.getQrCode(business.whatsapp_instance);
    return { qrCode: qr.qrcode ?? null, pairingCode: qr.code ?? null };
  });

/** Consulta o estado atual da conexão e sincroniza no banco. */
export const getWhatsappStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bizSchema.parse(d))
  .handler(async ({ context, data }) => {
    const business = await loadOwnedBusiness(context.supabase, data.businessId);
    if (!business.whatsapp_instance) {
      return { status: "desconectado" as const, connected: false };
    }
    const evo = await import("./evolution.server");
    const state = await evo.getConnectionState(business.whatsapp_instance);
    const status =
      state === "open"
        ? ("conectado" as const)
        : state === "connecting"
          ? ("conectando" as const)
          : ("desconectado" as const);
    if (status !== business.whatsapp_status) {
      await context.supabase
        .from("businesses")
        .update({ whatsapp_status: status })
        .eq("id", business.id);
    }
    return { status, connected: status === "conectado" };
  });

/** Desconecta e remove a instância do WhatsApp do negócio. */
export const disconnectWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => bizSchema.parse(d))
  .handler(async ({ context, data }) => {
    const business = await loadOwnedBusiness(context.supabase, data.businessId);
    if (business.whatsapp_instance) {
      const evo = await import("./evolution.server");
      await evo.deleteInstance(business.whatsapp_instance);
    }
    await context.supabase
      .from("businesses")
      .update({ whatsapp_instance: null, whatsapp_status: "desconectado" })
      .eq("id", business.id);
    return { ok: true };
  });

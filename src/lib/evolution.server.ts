// Integração com a Evolution API (WhatsApp via QR Code / multi-dispositivo).
// Requer EVOLUTION_API_URL (ex.: https://evo.seudominio.com) e EVOLUTION_API_KEY.

function config() {
  const baseUrl = process.env["EVOLUTION_API_URL"]?.replace(/\/$/, "");
  const apiKey = process.env["EVOLUTION_API_KEY"];
  if (!baseUrl || !apiKey)
    throw new Error(
      "A integração de WhatsApp ainda não foi configurada pela plataforma.",
    );
  return { baseUrl, apiKey };
}

async function call<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { baseUrl, apiKey } = config();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Evolution API [${res.status}] ${path}: ${text}`);
    throw new Error(`Falha na integração de WhatsApp (${res.status}).`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export type EvolutionQr = {
  qrcode?: string; // base64 data-url
  code?: string; // pairing code
};

export async function createInstance(instance: string): Promise<EvolutionQr> {
  return call<EvolutionQr>("/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: instance,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    }),
  });
}

export async function getQrCode(instance: string): Promise<EvolutionQr> {
  return call<EvolutionQr>(`/instance/connect/${instance}`);
}

export async function getConnectionState(
  instance: string,
): Promise<"open" | "connecting" | "close"> {
  try {
    const data = await call<{ instance?: { state?: string } }>(
      `/instance/connectionState/${instance}`,
    );
    const state = data.instance?.state ?? "close";
    if (state === "open") return "open";
    if (state === "connecting") return "connecting";
    return "close";
  } catch {
    return "close";
  }
}

export async function deleteInstance(instance: string): Promise<void> {
  try {
    await call(`/instance/logout/${instance}`, { method: "DELETE" });
  } catch {
    // ignora: instância pode já estar desconectada
  }
  try {
    await call(`/instance/delete/${instance}`, { method: "DELETE" });
  } catch {
    // ignora
  }
}

export function phoneToWhatsapp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function sendTextMessage(
  instance: string,
  phone: string,
  message: string,
): Promise<void> {
  await call(`/message/sendText/${instance}`, {
    method: "POST",
    body: JSON.stringify({
      number: phoneToWhatsapp(phone),
      text: message,
    }),
  });
}

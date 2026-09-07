// Integração com a Z-API (WhatsApp via QR Code / multi-dispositivo).
// Requer ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN (do painel da Z-API).

function config() {
  const instanceId = process.env["ZAPI_INSTANCE_ID"];
  const token = process.env["ZAPI_TOKEN"];
  const clientToken = process.env["ZAPI_CLIENT_TOKEN"];
  if (!instanceId || !token || !clientToken)
    throw new Error(
      "A integração de WhatsApp ainda não foi configurada pela plataforma.",
    );
  return {
    baseUrl: `https://api.z-api.io/instances/${instanceId}/token/${token}`,
    clientToken,
  };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, clientToken } = config();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Client-Token": clientToken,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Z-API [${res.status}] ${path}: ${text}`);
    throw new Error(`Falha na integração de WhatsApp (${res.status}).`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** QR Code atual da instância, como data-url base64 pronta para <img>. */
export async function getQrCode(): Promise<string | null> {
  const { baseUrl, clientToken } = config();
  const res = await fetch(`${baseUrl}/qr-code/image`, {
    headers: { "Client-Token": clientToken },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`Z-API [${res.status}] /qr-code/image: ${body}`);
    return null;
  }
  const buffer = await res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:image/png;base64,${base64}`;
}

/** true quando o WhatsApp está conectado e pronto para enviar. */
export async function isConnected(): Promise<boolean> {
  try {
    const data = await call<{ connected?: boolean; smartphoneConnected?: boolean }>(
      "/status",
    );
    return !!data.connected;
  } catch {
    return false;
  }
}

/** Desconecta o aparelho vinculado (a instância continua existindo). */
export async function disconnect(): Promise<void> {
  try {
    await call("/disconnect");
  } catch {
    // ignora: instância pode já estar desconectada
  }
}

export function phoneToWhatsapp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function sendTextMessage(
  phone: string,
  message: string,
): Promise<void> {
  await call("/send-text", {
    method: "POST",
    body: JSON.stringify({
      phone: phoneToWhatsapp(phone),
      message,
    }),
  });
}

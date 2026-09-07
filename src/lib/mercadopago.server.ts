const MP_API = "https://api.mercadopago.com";

function token() {
  const t = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  if (!t) throw new Error("Pagamento indisponível: credencial do Mercado Pago não configurada.");
  return t;
}

export type PixCharge = {
  providerPaymentId: string;
  status: string;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiresAt: string | null;
};

type MpPayment = {
  id: number | string;
  status: string;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
};

export async function createPixCharge(input: {
  amountCents: number;
  description: string;
  payerName: string;
  payerEmail: string;
  externalReference: string;
  expiresInMinutes?: number;
}): Promise<PixCharge> {
  const expiration = new Date(Date.now() + (input.expiresInMinutes ?? 20) * 60_000);
  const [first, ...rest] = input.payerName.trim().split(/\s+/);

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.externalReference,
    },
    body: JSON.stringify({
      transaction_amount: Number((input.amountCents / 100).toFixed(2)),
      description: input.description,
      payment_method_id: "pix",
      external_reference: input.externalReference,
      date_of_expiration: expiration.toISOString().replace("Z", "-00:00"),
      payer: {
        email: input.payerEmail,
        first_name: first || "Cliente",
        last_name: rest.join(" ") || "Agenda",
      },
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`Mercado Pago falhou [${res.status}]: ${body}`);
    throw new Error(`Não foi possível gerar o Pix [${res.status}]: ${body}`);
  }

  const data = JSON.parse(body) as MpPayment;
  const td = data.point_of_interaction?.transaction_data;
  return {
    providerPaymentId: String(data.id),
    status: data.status,
    qrCode: td?.qr_code ?? null,
    qrCodeBase64: td?.qr_code_base64 ?? null,
    ticketUrl: td?.ticket_url ?? null,
    expiresAt: data.date_of_expiration ?? expiration.toISOString(),
  };
}

export async function fetchPaymentStatus(providerPaymentId: string): Promise<string> {
  const res = await fetch(`${MP_API}/v1/payments/${providerPaymentId}`, {
    headers: { Authorization: `Bearer ${token()}` },
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Mercado Pago consulta falhou [${res.status}]: ${body}`);
    throw new Error(`Consulta ao Mercado Pago falhou [${res.status}]`);
  }
  return (JSON.parse(body) as MpPayment).status;
}

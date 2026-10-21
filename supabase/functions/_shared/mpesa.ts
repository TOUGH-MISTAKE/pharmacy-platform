const BASE_URLS: Record<string, string> = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
};

export interface MpesaConfig {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  shortCode: string;
  passKey: string;
  callbackUrl: string;
}

function requireSecret(name: string): string {
  const value = Deno.env.get(name);
  if (!value || value.trim() === "") {
    throw new Error(`The secret ${name} is not set in Supabase.`);
  }
  return value.trim();
}

export function loadMpesaConfig(): MpesaConfig {
  const environment = (Deno.env.get("MPESA_ENV") ?? "sandbox").trim().toLowerCase();
  const baseUrl = BASE_URLS[environment];
  if (!baseUrl) {
    throw new Error(`MPESA_ENV must be "sandbox" or "production", but it is "${environment}".`);
  }

  const supabaseUrl = requireSecret("SUPABASE_URL");
  const callbackToken = requireSecret("MPESA_CALLBACK_TOKEN");

  return {
    baseUrl,
    consumerKey: requireSecret("MPESA_CONSUMER_KEY"),
    consumerSecret: requireSecret("MPESA_CONSUMER_SECRET"),
    shortCode: requireSecret("MPESA_SHORTCODE"),
    passKey: requireSecret("MPESA_PASSKEY"),
    callbackUrl: `${supabaseUrl}/functions/v1/mpesa-callback?token=${encodeURIComponent(callbackToken)}`,
  };
}

/** Timestamp in the format Safaricom expects (YYYYMMDDHHmmss), in East Africa Time. */
export function eastAfricaTimestamp(date = new Date()): string {
  const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${eat.getUTCFullYear()}${pad(eat.getUTCMonth() + 1)}${pad(eat.getUTCDate())}` +
    `${pad(eat.getUTCHours())}${pad(eat.getUTCMinutes())}${pad(eat.getUTCSeconds())}`
  );
}

async function getAccessToken(config: MpesaConfig): Promise<string> {
  const credentials = btoa(`${config.consumerKey}:${config.consumerSecret}`);
  const response = await fetch(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${credentials}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Safaricom login failed with status ${response.status}. Check the consumer key and secret.`);
  }

  const body = await response.json();
  if (!body.access_token) {
    throw new Error("Safaricom did not return an access token.");
  }
  return body.access_token as string;
}

export interface StkPushInput {
  amount: number;
  phone: string;
  accountReference: string;
  description: string;
}

export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  customerMessage: string;
}

export async function initiateStkPush(config: MpesaConfig, input: StkPushInput): Promise<StkPushResult> {
  const token = await getAccessToken(config);
  const timestamp = eastAfricaTimestamp();
  const password = btoa(`${config.shortCode}${config.passKey}${timestamp}`);

  const response = await fetch(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: config.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: input.amount,
      PartyA: input.phone,
      PartyB: config.shortCode,
      PhoneNumber: input.phone,
      CallBackURL: config.callbackUrl,
      AccountReference: input.accountReference.slice(0, 12),
      TransactionDesc: input.description.slice(0, 13),
    }),
    signal: AbortSignal.timeout(20000),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || String(body.ResponseCode) !== "0") {
    const reason = body.errorMessage ?? body.ResponseDescription ?? `status ${response.status}`;
    throw new Error(`Safaricom rejected the payment request: ${reason}`);
  }

  return {
    merchantRequestId: String(body.MerchantRequestID),
    checkoutRequestId: String(body.CheckoutRequestID),
    customerMessage: String(body.CustomerMessage ?? ""),
  };
}

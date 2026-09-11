/**
 * UPS API — OAuth2 client-credentials flow + Shipping API.
 * Register an app at https://developer.ups.com to get a client id/secret,
 * plus a shipper account number from your UPS account.
 *
 * NOTE: UPS revises its Shipping API path version periodically
 * (e.g. /api/shipments/v2409/ship). Check developer.ups.com's current
 * "Shipping" API reference before going live and update UPS_API_VERSION
 * below if needed.
 *
 * Docs: https://developer.ups.com/api/reference?loc=en_US
 */

const UPS_API_VERSION = "v2409";

function baseUrl() {
  return process.env.UPS_ENV === "production"
    ? "https://onlinetools.ups.com"
    : "https://wwwcie.ups.com"; // sandbox
}

export function upsConfigured() {
  return !!process.env.UPS_CLIENT_ID && !!process.env.UPS_CLIENT_SECRET && !!process.env.UPS_ACCOUNT_NUMBER;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;

  const res = await fetch(`${baseUrl()}/security/v1/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.UPS_CLIENT_ID}:${process.env.UPS_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`UPS OAuth failed: ${await res.text()}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in) * 1000 };
  return cachedToken.token;
}

export type ShippingAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  countryCode: string; // ISO-2
  phone?: string;
};

export type CreatedLabel = {
  trackingNumber: string;
  labelUrl?: string;
  labelBase64?: string;
  carrier: "UPS" | "ROYAL_MAIL";
};

/**
 * Creates a shipment + label for one order. Package weight/dimensions are
 * fixed defaults suitable for a rolled or flat print — adjust per print if
 * needed (e.g. store weight/dims on the Print model).
 */
export async function createUpsShipment(params: {
  shipTo: ShippingAddress;
  reference: string; // e.g. order number
}): Promise<CreatedLabel> {
  const token = await getAccessToken();

  const payload = {
    ShipmentRequest: {
      Shipment: {
        Description: "Limited edition art print",
        Shipper: {
          Name: "Slowly Downward",
          ShipperNumber: process.env.UPS_ACCOUNT_NUMBER,
        },
        ShipTo: {
          Name: params.shipTo.name,
          Address: {
            AddressLine: [params.shipTo.line1, params.shipTo.line2].filter(Boolean),
            City: params.shipTo.city,
            PostalCode: params.shipTo.postalCode,
            CountryCode: params.shipTo.countryCode,
          },
        },
        ReferenceNumber: [{ Value: params.reference }],
        Package: [
          {
            Packaging: { Code: "02" }, // customer-supplied packaging
            PackageWeight: { UnitOfMeasurement: { Code: "KGS" }, Weight: "1" },
          },
        ],
      },
      LabelSpecification: { LabelImageFormat: { Code: "PDF" } },
    },
  };

  const res = await fetch(`${baseUrl()}/api/shipments/${UPS_API_VERSION}/ship`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      transId: crypto.randomUUID(),
      transactionSrc: "slowlydownward",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`UPS shipment creation failed: ${await res.text()}`);
  const data = await res.json();
  const result = data.ShipmentResponse.ShipmentResults;

  return {
    trackingNumber: result.ShipmentIdentificationNumber,
    labelBase64: result.PackageResults?.[0]?.ShippingLabel?.GraphicImage,
    carrier: "UPS" as const,
  };
}

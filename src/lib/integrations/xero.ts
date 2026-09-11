import { prisma } from "@/lib/prisma";

/**
 * Xero Accounting API — OAuth2 authorization-code flow.
 *
 * Setup (one-off, done by an admin from Admin > Settings > Integrations):
 *   1. Create an app at https://developer.xero.com/app/manage
 *   2. Set the redirect URI to XERO_REDIRECT_URI (see .env.example)
 *   3. Visit /api/integrations/xero/connect to start the OAuth flow — this
 *      redirects to Xero, then back to /api/integrations/xero/callback,
 *      which stores the refresh token + tenant id in IntegrationSetting.
 *
 * Docs: https://developer.xero.com/documentation/guides/oauth2/auth-flow/
 */

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";

type XeroTokenConfig = {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  expiresAt: number; // epoch ms
};

async function getStoredConfig(): Promise<XeroTokenConfig | null> {
  const setting = await prisma.integrationSetting.findUnique({ where: { provider: "XERO" } });
  if (!setting || !setting.enabled) return null;
  return setting.config as unknown as XeroTokenConfig;
}

async function saveConfig(config: XeroTokenConfig) {
  await prisma.integrationSetting.upsert({
    where: { provider: "XERO" },
    update: { config: config as any, enabled: true },
    create: { provider: "XERO", config: config as any, enabled: true },
  });
}

async function refreshAccessToken(config: XeroTokenConfig): Promise<XeroTokenConfig> {
  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: config.refreshToken }),
  });
  if (!res.ok) throw new Error(`Xero token refresh failed: ${await res.text()}`);
  const data = await res.json();
  const updated: XeroTokenConfig = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tenantId: config.tenantId,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  await saveConfig(updated);
  return updated;
}

async function getValidToken(): Promise<XeroTokenConfig | null> {
  let config = await getStoredConfig();
  if (!config) return null;
  if (Date.now() > config.expiresAt - 60_000) {
    config = await refreshAccessToken(config);
  }
  return config;
}

export function xeroConfigured() {
  return !!process.env.XERO_CLIENT_ID && !!process.env.XERO_CLIENT_SECRET;
}

/**
 * Creates a draft sales invoice in Xero for a completed order, so it's ready
 * for the accounts team to review and approve. Contact is matched/created by
 * email.
 */
export async function createXeroInvoiceForOrder(orderId: string) {
  const token = await getValidToken();
  if (!token) {
    console.warn("Xero not connected — skipping invoice for order", orderId);
    return null;
  }

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { customer: true, items: { include: { print: true, edition: true } } },
  });

  const headers = {
    Authorization: `Bearer ${token.accessToken}`,
    "Xero-tenant-id": token.tenantId,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const invoicePayload = {
    Invoices: [
      {
        Type: "ACCREC",
        Contact: { EmailAddress: order.customer.email, Name: order.customer.email },
        LineItems: order.items.map((item) => ({
          Description: `${item.print.title}${item.edition ? ` — edition #${item.edition.number}` : ""}`,
          Quantity: 1,
          UnitAmount: item.unitPriceMinor / 100,
          AccountCode: "200", // default UK Xero chart of accounts "Sales" code — adjust to match the store's chart
        })),
        Status: "DRAFT",
        Reference: order.orderNumber,
      },
    ],
  };

  const res = await fetch(`${XERO_API_BASE}/Invoices`, {
    method: "POST",
    headers,
    body: JSON.stringify(invoicePayload),
  });
  if (!res.ok) throw new Error(`Xero invoice creation failed: ${await res.text()}`);
  const data = await res.json();
  const invoiceId = data.Invoices?.[0]?.InvoiceID;

  await prisma.order.update({ where: { id: orderId }, data: { xeroInvoiceId: invoiceId } });
  return invoiceId;
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Completes the Xero OAuth2 flow: exchanges the code for tokens, fetches
// the connected tenant id, and stores both so createXeroInvoiceForOrder
// can use them later.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  const tokenRes = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.XERO_REDIRECT_URI ?? "",
    }),
  });
  if (!tokenRes.ok) {
    return NextResponse.json({ error: `Xero token exchange failed: ${await tokenRes.text()}` }, { status: 400 });
  }
  const tokens = await tokenRes.json();

  const connectionsRes = await fetch("https://api.xero.com/connections", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const connections = await connectionsRes.json();
  const tenantId = connections?.[0]?.tenantId;

  await prisma.integrationSetting.upsert({
    where: { provider: "XERO" },
    update: {
      enabled: true,
      config: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tenantId,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      },
    },
    create: {
      provider: "XERO",
      enabled: true,
      config: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tenantId,
        expiresAt: Date.now() + tokens.expires_in * 1000,
      },
    },
  });

  return NextResponse.redirect(new URL("/admin/settings/integrations?connected=xero", req.url));
}

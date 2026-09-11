import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Starts the Xero OAuth2 authorization-code flow.
// https://developer.xero.com/documentation/guides/oauth2/auth-flow/
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.XERO_CLIENT_ID ?? "",
    redirect_uri: process.env.XERO_REDIRECT_URI ?? "",
    scope: "openid profile email accounting.transactions accounting.contacts offline_access",
    state: "slowlydownward",
  });

  return NextResponse.redirect(`https://login.xero.com/identity/connect/authorize?${params.toString()}`);
}

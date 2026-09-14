import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { getLiveActivity } from "@/lib/analytics";

// Polled every ~10s by the dashboard's live widgets (src/components/admin/LiveStatsWidgets.tsx).
// Not under /admin/* so next-auth's middleware doesn't already guard it —
// checked here instead.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !canAccess(session.user.role as any, "dashboard")) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const stats = await getLiveActivity();
  return NextResponse.json(stats);
}

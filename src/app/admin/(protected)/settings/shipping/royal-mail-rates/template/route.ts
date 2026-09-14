import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { royalMailRatesCsvTemplate } from "@/lib/royal-mail-rates";

/** A short example CSV matching the exact columns the importer expects —
 * offered as a download so the format is unambiguous before building a real
 * export to match it. Sits under /admin/, so middleware's RBAC already
 * covers it; checks its own session anyway since a Route Handler can be
 * requested directly. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  return new NextResponse(royalMailRatesCsvTemplate(), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="royal-mail-rates-example.csv"`,
    },
  });
}

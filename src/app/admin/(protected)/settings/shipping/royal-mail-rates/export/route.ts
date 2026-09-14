import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRoyalMailRates, royalMailRatesToCsv } from "@/lib/royal-mail-rates";

/** Downloads the price list currently saved in the database as CSV — handy
 * to check what's actually stored, or as a starting point to edit and
 * re-upload. Sits under /admin/, so middleware's RBAC already covers it;
 * checks its own session anyway since a Route Handler can be requested
 * directly. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const rates = await getRoyalMailRates();
  return new NextResponse(royalMailRatesToCsv(rates), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="royal-mail-rates.csv"`,
    },
  });
}

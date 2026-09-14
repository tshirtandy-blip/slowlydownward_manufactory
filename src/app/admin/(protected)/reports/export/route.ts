import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { getReportType, toCsv } from "@/lib/report-types";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !canAccess(session.user.role as any, "reports")) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "";
  const reportType = getReportType(type);
  if (!reportType) {
    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  }

  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const table = await reportType.run({ from, to });
  const csv = toCsv(table);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

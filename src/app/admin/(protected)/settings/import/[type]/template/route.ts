import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getImportType } from "@/lib/imports/registry";

/** A short example CSV matching the exact columns each importer expects —
 * offered as a download so the format is unambiguous before filling in a
 * real one. Sits under /admin/, so middleware's RBAC already covers it;
 * checks its own session anyway since a Route Handler can be requested
 * directly. */
export async function GET(_req: Request, { params }: { params: { type: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  const type = getImportType(params.type);
  if (!type) {
    return NextResponse.json({ error: "Unknown import type." }, { status: 404 });
  }

  return new NextResponse(type.template(), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${type.key}-template.csv"`,
    },
  });
}

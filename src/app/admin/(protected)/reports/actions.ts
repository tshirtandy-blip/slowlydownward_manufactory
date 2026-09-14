"use server";

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getReportType } from "@/lib/report-types";

async function requireReportsAccess() {
  const session = await getServerSession(authOptions);
  if (!session || !canAccess(session.user.role as any, "reports")) throw new Error("Not authorised");
  return session;
}

export async function saveReport(formData: FormData) {
  await requireReportsAccess();

  const type = String(formData.get("type") || "");
  if (!getReportType(type)) throw new Error("Unknown report type");
  const name = String(formData.get("name") || "").trim();
  const from = String(formData.get("from") || "");
  const to = String(formData.get("to") || "");

  const report = await prisma.savedReport.create({
    data: {
      name: name || getReportType(type)!.label,
      type,
      params: { from: from || undefined, to: to || undefined },
    },
  });

  revalidatePath("/admin/reports");
  redirect(`/admin/reports/saved/${report.id}`);
}

export async function deleteSavedReport(id: string) {
  await requireReportsAccess();
  await prisma.savedReport.delete({ where: { id } });
  revalidatePath("/admin/reports");
  redirect("/admin/reports");
}

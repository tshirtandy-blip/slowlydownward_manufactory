import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/rbac";

export default async function AdminIndexPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");
  redirect(defaultRouteForRole(session.user.role));
}

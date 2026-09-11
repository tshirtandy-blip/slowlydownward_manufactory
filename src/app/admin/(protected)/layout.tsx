import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  return (
    <div className="flex">
      <AdminSidebar role={session.user.role} name={session.user.name ?? session.user.email ?? ""} />
      <main className="flex-1 min-h-screen bg-paper px-10 py-8">{children}</main>
    </div>
  );
}

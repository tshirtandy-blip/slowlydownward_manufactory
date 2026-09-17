import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/admin/login");

  const role = session.user.role;
  const name = session.user.name ?? session.user.email ?? "";

  return (
    <div className="md:flex">
      <AdminSidebar role={role} name={name} />
      <div className="flex-1 min-h-screen">
        <AdminMobileNav role={role} name={name} />
        <main className="min-h-screen bg-paper px-6 py-6 md:px-10 md:py-8">{children}</main>
      </div>
    </div>
  );
}

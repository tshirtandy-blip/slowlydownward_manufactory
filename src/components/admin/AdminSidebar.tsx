import Link from "next/link";
import type { Role } from "@prisma/client";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdminNavLinks } from "./AdminNavLinks";
import { AdminUserMenu } from "./AdminUserMenu";

export function AdminSidebar({ role, name }: { role: Role; name: string }) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col justify-between border-r border-line min-h-screen py-8">
      <div className="flex min-h-0 flex-1 flex-col">
        <Link href="/admin" className="font-display text-lg block mb-8 px-6">
          Slowly Downward
        </Link>
        <ScrollArea className="flex-1 px-6">
          <AdminNavLinks role={role} />
        </ScrollArea>
      </div>
      <div className="px-6 pt-6">
        <Separator className="mb-4" />
        <AdminUserMenu role={role} name={name} />
      </div>
    </aside>
  );
}

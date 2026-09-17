"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@prisma/client";
import { canAccess } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { ADMIN_NAV } from "./nav-items";

export function AdminNavLinks({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {ADMIN_NAV.filter((item) => canAccess(role, item.section as any)).map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2 text-sm transition-colors",
              active ? "bg-ink text-paper" : "text-ink hover:bg-secondary"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

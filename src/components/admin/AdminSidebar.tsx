"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Role } from "@prisma/client";
import { canAccess } from "@/lib/rbac";

const NAV: { href: string; label: string; section: string }[] = [
  { href: "/admin/dashboard", label: "Dashboard", section: "dashboard" },
  { href: "/admin/orders", label: "Orders", section: "orders" },
  { href: "/admin/customers", label: "Clients", section: "customers" },
  { href: "/admin/pack", label: "Packing queue", section: "pack" },
  { href: "/admin/products", label: "Product", section: "products" },
  { href: "/admin/reports", label: "Reports", section: "reports" },
  { href: "/admin/pages", label: "Pages", section: "pages" },
  { href: "/admin/settings", label: "Settings", section: "settings" },
];

export function AdminSidebar({ role, name }: { role: Role; name: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r hairline min-h-screen py-8 px-6 flex flex-col justify-between">
      <div>
        <Link href="/admin" className="font-display text-lg block mb-1">
          Slowly Downward
        </Link>
        <p className="label-caps text-stone mb-10">{role}</p>

        <nav className="space-y-1">
          {NAV.filter((item) => canAccess(role, item.section as any)).map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 text-sm rounded ${
                  active ? "bg-ink text-paper" : "hover:bg-line"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div>
        <p className="text-sm text-stone mb-3">{name}</p>
        <button onClick={() => signOut({ callbackUrl: "/admin/login" })} className="label-caps text-stone hover:text-accent">
          Sign out
        </button>
      </div>
    </aside>
  );
}

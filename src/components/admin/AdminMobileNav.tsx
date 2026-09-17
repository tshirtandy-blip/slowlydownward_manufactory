"use client";

import { useState } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminNavLinks } from "./AdminNavLinks";
import { AdminUserMenu } from "./AdminUserMenu";

export function AdminMobileNav({ role, name }: { role: Role; name: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex md:hidden items-center justify-between border-b border-line px-4 py-3">
      <Link href="/admin" className="font-display text-base">
        Slowly Downward
      </Link>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="border-line" aria-label="Open menu">
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetHeader className="px-6 pt-6 text-left">
            <SheetTitle className="font-display text-lg font-normal">Slowly Downward</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <AdminNavLinks role={role} onNavigate={() => setOpen(false)} />
          </div>
          <div className="px-6 pb-6">
            <Separator className="mb-4" />
            <AdminUserMenu role={role} name={name} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

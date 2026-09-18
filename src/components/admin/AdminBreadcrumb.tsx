"use client";
import * as React from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ADMIN_NAV } from "./nav-items";

function humanize(segment: string) {
  return segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// A segment that looks like a database id (cuid/uuid-ish) gets a generic
// "Detail" label rather than an unreadable string in the breadcrumb.
function isLikelyId(segment: string) {
  return /^[a-z0-9-]{20,}$/i.test(segment);
}

export function AdminBreadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).filter((s) => s !== "admin");
  const section = ADMIN_NAV.find((item) => item.section === segments[0]);

  const crumbs: { href: string; label: string }[] = [{ href: "/admin/dashboard", label: "Dashboard" }];
  if (section) crumbs.push({ href: section.href, label: section.label });
  segments.slice(1).forEach((seg, i) => {
    crumbs.push({
      href: "/admin/" + segments.slice(0, i + 2).join("/"),
      label: isLikelyId(seg) ? "Detail" : humanize(seg),
    });
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <React.Fragment key={crumb.href}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

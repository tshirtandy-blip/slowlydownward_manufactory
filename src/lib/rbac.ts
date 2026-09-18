import { Role } from "@prisma/client";

/**
 * Central map of which roles can see which admin sections.
 * ADMIN always has access to everything.
 */
export const SECTION_ACCESS: Record<string, Role[]> = {
  dashboard: ["ADMIN", "SALES"],
  orders: ["ADMIN", "SALES"],
  customers: ["ADMIN", "SALES"],
  campaigns: ["ADMIN", "SALES"],
  pack: ["ADMIN", "PACKER"],
  products: ["ADMIN", "STOCK"],
  reports: ["ADMIN", "SALES"],
  settings: ["ADMIN"],
  pages: ["ADMIN"],
};

export function canAccess(role: Role | undefined, section: keyof typeof SECTION_ACCESS): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;
  return SECTION_ACCESS[section]?.includes(role) ?? false;
}

/** Where to send each role when they land on /admin with no more specific page. */
export function defaultRouteForRole(role: Role): string {
  switch (role) {
    case "ADMIN":
      return "/admin/dashboard";
    case "SALES":
      return "/admin/orders";
    case "STOCK":
      return "/admin/products";
    case "PACKER":
      return "/admin/pack";
    default:
      return "/admin/login";
  }
}

import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  PackageCheck,
  Package,
  BarChart3,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  section: string;
  icon: LucideIcon;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", section: "dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", section: "orders", icon: ShoppingCart },
  { href: "/admin/customers", label: "Clients", section: "customers", icon: Users },
  { href: "/admin/pack", label: "Packing queue", section: "pack", icon: PackageCheck },
  { href: "/admin/products", label: "Product", section: "products", icon: Package },
  { href: "/admin/reports", label: "Reports", section: "reports", icon: BarChart3 },
  { href: "/admin/pages", label: "Pages", section: "pages", icon: FileText },
  { href: "/admin/settings", label: "Settings", section: "settings", icon: Settings },
];

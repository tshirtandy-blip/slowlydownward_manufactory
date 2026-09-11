import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { canAccess } from "@/lib/rbac";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    const sectionMatch = path.match(/^\/admin\/([a-z]+)/);
    const section = sectionMatch?.[1];

    // /admin, /admin/login always allowed through (login page itself, or the
    // role-based redirector at /admin/page.tsx)
    if (!section || section === "login") return NextResponse.next();

    const role = token?.role as any;
    if (["dashboard", "orders", "customers", "pack", "stock", "settings"].includes(section)) {
      if (!canAccess(role, section as any)) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (req.nextUrl.pathname.startsWith("/admin/login")) return true;
        return !!token;
      },
    },
    pages: {
      signIn: "/admin/login",
    },
  }
);

export const config = {
  matcher: ["/admin/:path*"],
};

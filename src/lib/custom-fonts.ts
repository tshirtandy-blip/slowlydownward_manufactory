import { prisma } from "@/lib/prisma";

export async function getCustomFonts() {
  try {
    return await prisma.customFont.findMany({ orderBy: { sortOrder: "asc" } });
  } catch {
    // Database unreachable, or this migration hasn't been run yet — the
    // storefront should still render with just the built-in system fonts
    // rather than crash.
    return [];
  }
}

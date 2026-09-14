"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blocksArraySchema, type Block } from "@/lib/blocks";
import { sanitizeBlocks } from "@/lib/sanitize";
import { slugify, RESERVED_SLUGS } from "@/lib/slugify";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

export async function createPage(formData: FormData) {
  await requireAdmin();

  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Title is required");

  const slug = slugify(String(formData.get("slug") || "") || title);
  if (!slug || RESERVED_SLUGS.has(slug)) {
    throw new Error(`"/${slug}" isn't available as a page address — try something else.`);
  }

  const existing = await prisma.page.findUnique({ where: { slug } });
  if (existing) throw new Error("A page with that address already exists.");

  const page = await prisma.page.create({
    data: { title, slug, blocks: [] },
  });

  revalidatePath("/admin/pages");
  redirect(`/admin/pages/${page.id}`);
}

export async function savePageBlocks(pageId: string, blocks: Block[]) {
  await requireAdmin();
  const parsed = sanitizeBlocks(blocksArraySchema.parse(blocks));

  // Cast: `parsed` is already zod-validated against blocksArraySchema above,
  // but its type (with optional fields) doesn't structurally match Prisma's
  // generated JSON input type, which TS can't otherwise reconcile.
  const page = await prisma.page.update({
    where: { id: pageId },
    data: { blocks: parsed as Prisma.InputJsonValue },
  });

  revalidatePath("/admin/pages");
  revalidatePath(page.slug === "home" ? "/" : `/${page.slug}`);
}

export async function updatePageMeta(pageId: string, formData: FormData) {
  await requireAdmin();

  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) throw new Error("Page not found");

  const title = String(formData.get("title") || "").trim();
  if (!title) throw new Error("Title is required");

  // The home page has no status field in its settings form (it's always
  // live), so only touch status when the form actually submitted one.
  const statusField = formData.get("status");
  const status = statusField === null ? page.status : statusField === "PUBLISHED" ? "PUBLISHED" : "DRAFT";

  let slug = page.slug;
  if (page.slug !== "home") {
    const nextSlug = slugify(String(formData.get("slug") || title));
    if (!nextSlug || RESERVED_SLUGS.has(nextSlug)) {
      throw new Error(`"/${nextSlug}" isn't available as a page address — try something else.`);
    }
    if (nextSlug !== page.slug) {
      const clash = await prisma.page.findUnique({ where: { slug: nextSlug } });
      if (clash) throw new Error("A page with that address already exists.");
    }
    slug = nextSlug;
  }

  await prisma.page.update({
    where: { id: pageId },
    data: { title, slug, status },
  });

  revalidatePath("/admin/pages");
  revalidatePath(`/admin/pages/${pageId}`);
  revalidatePath(page.slug === "home" ? "/" : `/${page.slug}`);
  revalidatePath(slug === "home" ? "/" : `/${slug}`);
}

export async function deletePage(pageId: string) {
  await requireAdmin();

  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) return;
  if (page.slug === "home") throw new Error("The home page can't be deleted.");

  await prisma.page.delete({ where: { id: pageId } });

  revalidatePath("/admin/pages");
  revalidatePath(`/${page.slug}`);
  redirect("/admin/pages");
}

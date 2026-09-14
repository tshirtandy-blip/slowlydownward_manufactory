"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blocksArraySchema, type Block } from "@/lib/blocks";
import { sanitizeBlocks } from "@/lib/sanitize";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

export async function savePrintContentBlocks(printId: string, blocks: Block[]) {
  await requireAdmin();
  const parsed = sanitizeBlocks(blocksArraySchema.parse(blocks));

  const print = await prisma.print.update({
    where: { id: printId },
    data: { contentBlocks: parsed as Prisma.InputJsonValue },
  });

  revalidatePath("/admin/pages/products");
  revalidatePath(`/admin/pages/products/${printId}`);
  revalidatePath(`/prints/${print.slug}`);
}

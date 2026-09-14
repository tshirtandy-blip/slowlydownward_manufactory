"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { createManualOrder, ManualOrderItemInput, CreateManualOrderResult } from "@/lib/manual-orders";

async function requireOrdersAccess() {
  const session = await getServerSession(authOptions);
  if (!session || !canAccess(session.user.role as any, "orders")) throw new Error("Not authorised");
  return session;
}

export async function createManualOrderAction(params: {
  customerEmail: string;
  country: string;
  items: ManualOrderItemInput[];
  note?: string;
}): Promise<CreateManualOrderResult> {
  const session = await requireOrdersAccess();
  return createManualOrder({ ...params, createdByUserId: (session.user as any).id });
}

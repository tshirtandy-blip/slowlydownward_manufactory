"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SITE_SETTINGS_ID } from "@/lib/site-settings";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

function revalidateEverywhere() {
  // The popup renders in the root layout on every storefront route, and
  // the withdrawal button on the order history page — same "no one path"
  // situation as the footer (see settings/footer/actions.ts).
  revalidatePath("/", "layout");
  revalidatePath("/admin/settings/legal");
}

/** Saves the cookie/signup popup's text and on/off switch, and how many
 * days the "Withdraw from contract" button (Admin > Settings > Legal &
 * popup, src/app/account/orders) tells customers they have. */
export async function updateLegalSettings(formData: FormData) {
  await requireAdmin();

  const field = (name: string, fallback: string) => String(formData.get(name) || "").trim() || fallback;

  const withdrawalPeriodDaysRaw = Number(formData.get("withdrawalPeriodDays"));
  const withdrawalPeriodDays =
    Number.isFinite(withdrawalPeriodDaysRaw) && withdrawalPeriodDaysRaw > 0 ? Math.round(withdrawalPeriodDaysRaw) : 14;

  const data = {
    cookiePopupEnabled: formData.get("cookiePopupEnabled") === "on",
    cookiePopupMessage: field(
      "cookiePopupMessage",
      "We use a few essential cookies to keep the site and your basket working. Nothing beyond that."
    ),
    cookiePopupSignupHeading: field("cookiePopupSignupHeading", "Hear about new releases"),
    cookiePopupSignupBody: field(
      "cookiePopupSignupBody",
      "Leave your email if you'd like to know when a new print goes live, before it's announced anywhere else."
    ),
    withdrawalPeriodDays,
  };

  await prisma.siteSettings.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: data,
    create: { id: SITE_SETTINGS_ID, ...data },
  });

  revalidateEverywhere();
}

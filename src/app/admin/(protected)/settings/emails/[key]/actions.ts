"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { sendEmail, emailConfigured } from "@/lib/integrations/resend";
import {
  saveEmailTemplate,
  renderSampleEmail,
  EMAIL_TEMPLATE_KEYS,
  type EmailTemplateKey,
} from "@/lib/email-templates";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") throw new Error("Not authorised");
  return session;
}

function isTemplateKey(key: string): key is EmailTemplateKey {
  return (EMAIL_TEMPLATE_KEYS as string[]).includes(key);
}

export async function updateEmailTemplate(
  key: string,
  input: { subject: string; introHtml: string; closingHtml: string }
): Promise<ActionResult> {
  await requireAdmin();
  if (!isTemplateKey(key)) return { ok: false, error: "Unknown email template." };
  if (!input.subject.trim()) return { ok: false, error: "Subject can't be empty." };

  try {
    await saveEmailTemplate(key, input);
    revalidatePath(`/admin/settings/emails/${key}`);
    return { ok: true };
  } catch (err) {
    console.error("updateEmailTemplate failed:", err);
    return { ok: false, error: "Something went wrong saving this email." };
  }
}

/** Sends the current saved version of a template, filled in with sample
 * order data, to the signed-in admin's own email — so wording can be
 * checked in a real inbox before it ever reaches a customer. */
export async function sendTestEmail(key: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!isTemplateKey(key)) return { ok: false, error: "Unknown email template." };
  if (!emailConfigured()) return { ok: false, error: "Email isn't set up yet — add Resend details first." };

  try {
    const { subject, html } = await renderSampleEmail(key);
    await sendEmail({ to: session.user.email!, subject: `[Test] ${subject}`, html });
    return { ok: true };
  } catch (err: any) {
    console.error("sendTestEmail failed:", err);
    return { ok: false, error: err?.message || "Couldn't send the test email." };
  }
}

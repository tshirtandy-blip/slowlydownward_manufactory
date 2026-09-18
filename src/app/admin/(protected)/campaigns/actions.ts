"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/sanitize";
import { sendEmail, emailConfigured } from "@/lib/integrations/resend";
import { getSiteSettings } from "@/lib/site-settings";
import {
  createBroadcast,
  sendBroadcast,
  cancelBroadcast,
  estimateRecipientCount,
  resendBroadcastsConfigured,
} from "@/lib/integrations/resend-broadcasts";
import type { CampaignAudience } from "@prisma/client";

async function requireCampaignsAccess() {
  const session = await getServerSession(authOptions);
  if (!session || !canAccess(session.user.role as any, "campaigns")) throw new Error("Not authorised");
  return session;
}

const WRAPPER_OPEN = `<div style="font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;max-width:520px;margin:0 auto;">`;
const WRAPPER_CLOSE = `</div>`;

async function wrapCampaignHtml(bodyHtml: string): Promise<string> {
  const settings = await getSiteSettings();
  const logo = settings.emailLogoUrl
    ? `<p style="text-align:center;margin:0 0 28px;"><img src="${settings.emailLogoUrl}" alt="" style="max-width:220px;max-height:90px;width:auto;height:auto;border:0;display:inline-block;" /></p>`
    : "";
  return WRAPPER_OPEN + logo + bodyHtml + WRAPPER_CLOSE;
}

function isAudience(value: string): value is CampaignAudience {
  return value === "ALL" || value === "CUSTOMERS";
}

/** Live count for the compose page's "sending to N people" line — recomputed
 * on every keystroke-adjacent change to the audience dropdown, from our own
 * data rather than Resend's (which lags a little behind, see
 * src/lib/integrations/resend-broadcasts.ts). */
export async function previewRecipientCount(audience: string): Promise<number> {
  await requireCampaignsAccess();
  return estimateRecipientCount(isAudience(audience) ? audience : "ALL");
}

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

/** Creates a new draft (id null) or saves changes to an existing one — only
 * ever a DRAFT; a campaign that's been sent or scheduled is fixed (see
 * cancelScheduledCampaign to pull a scheduled one back to draft first). */
export async function saveCampaignDraft(
  id: string | null,
  input: { subject: string; html: string; audience: string }
): Promise<SaveResult> {
  const session = await requireCampaignsAccess();

  const subject = input.subject.trim();
  if (!subject) return { ok: false, error: "Give it a subject line first." };
  const html = sanitizeRichText(input.html);
  const audience: CampaignAudience = isAudience(input.audience) ? input.audience : "ALL";

  if (id) {
    const existing = await prisma.campaign.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "That campaign no longer exists." };
    if (existing.status !== "DRAFT") return { ok: false, error: "Only a draft can be edited." };
    await prisma.campaign.update({ where: { id }, data: { subject, html, audience } });
    revalidatePath(`/admin/campaigns/${id}`);
    return { ok: true, id };
  }

  const created = await prisma.campaign.create({
    data: { subject, html, audience, createdByUserId: (session.user as any).id ?? null },
  });
  revalidatePath("/admin/campaigns");
  return { ok: true, id: created.id };
}

export type SendResult = { ok: true } | { ok: false; error: string };

/** Sends a draft immediately. */
export async function sendCampaignNow(id: string): Promise<SendResult> {
  await requireCampaignsAccess();
  if (!resendBroadcastsConfigured()) return { ok: false, error: "Resend isn't configured yet." };

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return { ok: false, error: "That campaign no longer exists." };
  if (campaign.status !== "DRAFT") return { ok: false, error: "This campaign has already been sent or scheduled." };

  try {
    const html = await wrapCampaignHtml(campaign.html);
    const recipientCount = await estimateRecipientCount(campaign.audience);
    const broadcastId = await createBroadcast({ subject: campaign.subject, html, audience: campaign.audience });
    await sendBroadcast(broadcastId);
    await prisma.campaign.update({
      where: { id },
      data: { status: "SENT", resendBroadcastId: broadcastId, recipientCount, sentAt: new Date() },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sending failed." };
  }

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
  return { ok: true };
}

/** Schedules a draft for a future date/time — scheduledForIso must be an
 * ISO 8601 timestamp in the future (the date/time picker on the compose
 * page produces this from the browser's own timezone). */
export async function scheduleCampaign(id: string, scheduledForIso: string): Promise<SendResult> {
  await requireCampaignsAccess();
  if (!resendBroadcastsConfigured()) return { ok: false, error: "Resend isn't configured yet." };

  const scheduledFor = new Date(scheduledForIso);
  if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) {
    return { ok: false, error: "Pick a date and time in the future." };
  }

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return { ok: false, error: "That campaign no longer exists." };
  if (campaign.status !== "DRAFT") return { ok: false, error: "This campaign has already been sent or scheduled." };

  try {
    const html = await wrapCampaignHtml(campaign.html);
    const recipientCount = await estimateRecipientCount(campaign.audience);
    const broadcastId = await createBroadcast({ subject: campaign.subject, html, audience: campaign.audience });
    await sendBroadcast(broadcastId, scheduledFor.toISOString());
    await prisma.campaign.update({
      where: { id },
      data: { status: "SCHEDULED", resendBroadcastId: broadcastId, recipientCount, scheduledFor },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Scheduling failed." };
  }

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
  return { ok: true };
}

/** Pulls a still-scheduled campaign back to draft — cancels the Resend
 * broadcast (which cancels the scheduled delivery) and clears the fields
 * that only make sense once something's actually been scheduled/sent. */
export async function cancelScheduledCampaign(id: string): Promise<SendResult> {
  await requireCampaignsAccess();

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return { ok: false, error: "That campaign no longer exists." };
  if (campaign.status !== "SCHEDULED") return { ok: false, error: "This campaign isn't scheduled." };

  try {
    if (campaign.resendBroadcastId) await cancelBroadcast(campaign.resendBroadcastId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't cancel the scheduled send." };
  }

  await prisma.campaign.update({
    where: { id },
    data: { status: "DRAFT", resendBroadcastId: null, scheduledFor: null, recipientCount: null },
  });
  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${id}`);
  return { ok: true };
}

/** Plain-form-action wrapper around cancelScheduledCampaign — a bare
 * `<form action={...}>` (no useFormState/useActionState) can't read a
 * returned value, and its action prop's type only accepts a function
 * returning void | Promise<void>, not our SendResult. Throwing on failure
 * at least surfaces a problem via Next's error boundary instead of the
 * form silently doing nothing. */
export async function cancelScheduledCampaignAction(id: string): Promise<void> {
  const result = await cancelScheduledCampaign(id);
  if (!result.ok) throw new Error(result.error);
}

/** Deletes a draft that was never sent — a sent or scheduled campaign is
 * kept for its history/stats (cancel a scheduled one back to draft first
 * if it genuinely needs deleting). */
export async function deleteCampaignDraft(id: string) {
  await requireCampaignsAccess();
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return;
  if (campaign.status !== "DRAFT") throw new Error("Only a draft can be deleted.");
  await prisma.campaign.delete({ where: { id } });
  revalidatePath("/admin/campaigns");
  redirect("/admin/campaigns");
}

/** Deletes any campaign that isn't actively scheduled or mid-send — the
 * general-purpose delete for the campaigns list/detail pages, e.g. to clear
 * out duplicate-content campaigns brought in by the one-off Mailchimp
 * import (see scripts/import-mailchimp-campaigns.ts). A SENT campaign also
 * disappears from the public archive (src/app/archive) once deleted, since
 * that page reads the same row. A scheduled send has to be cancelled first
 * (cancelScheduledCampaign, above) — deleting it out from under Resend
 * would leave the broadcast itself still scheduled. */
export async function deleteCampaign(id: string) {
  await requireCampaignsAccess();
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return;
  if (campaign.status === "SCHEDULED") {
    throw new Error("Cancel the scheduled send first, then delete it.");
  }
  if (campaign.status === "SENDING") {
    throw new Error("Can't delete a campaign that's currently sending.");
  }
  await prisma.$transaction([
    prisma.campaignEvent.deleteMany({ where: { campaignId: id } }),
    prisma.campaign.delete({ where: { id } }),
  ]);
  revalidatePath("/admin/campaigns");
  revalidatePath("/archive");
  redirect("/admin/campaigns");
}

export type TestResult = { ok: true } | { ok: false; error: string };

/** Sends the current draft content to one address for a look before it goes
 * out for real — uses the plain transactional sender (src/lib/integrations/
 * resend.ts), not a Resend Broadcast, so it doesn't touch recipient counts,
 * segments, or campaign status at all. */
export async function sendTestCampaignEmail(id: string, testEmail: string): Promise<TestResult> {
  await requireCampaignsAccess();
  if (!emailConfigured()) return { ok: false, error: "Email isn't set up yet." };

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return { ok: false, error: "Save the draft first." };

  try {
    const html = await wrapCampaignHtml(campaign.html);
    await sendEmail({ to: testEmail, subject: `[TEST] ${campaign.subject}`, html });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't send the test." };
  }
  return { ok: true };
}

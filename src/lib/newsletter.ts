"use server";

import { prisma } from "@/lib/prisma";
import { upsertMailchimpMember } from "@/lib/integrations/mailchimp";
import { upsertResendContact } from "@/lib/integrations/resend-broadcasts";

export type SubscribeResult = { ok: true } | { ok: false; error: string };

/** Records marketing consent for an email address and syncs it to
 * Mailchimp — used by both the cookie/signup popup
 * (CookieConsentPopup.tsx) and the footer's own signup form
 * (NewsletterSignupForm.tsx), so there's exactly one place this happens.
 * Deliberately separate from the cookie-acceptance action: accepting the
 * cookie notice and opting into marketing email are two different
 * consents, so one is never implied by the other.
 *
 * Upserts a Customer row by email the same way checkout and manual orders
 * already do — someone who only ever signs up here (never places an
 * order) just gets a passwordHash-less Customer row, same as a guest
 * checkout, which is enough to hold their marketing preference and let it
 * carry over automatically if they later place an order or register with
 * that same address. */
export async function subscribeToNewsletter(rawEmail: string): Promise<SubscribeResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  let customer;
  try {
    const now = new Date();
    customer = await prisma.customer.upsert({
      where: { email },
      update: { marketingOptIn: true, marketingConsentAt: now },
      create: { email, marketingOptIn: true, marketingConsentAt: now },
    });
  } catch (err) {
    console.error("subscribeToNewsletter: failed to save consent:", err);
    return { ok: false, error: "Something went wrong — try again in a moment." };
  }

  // Mailchimp/Resend being unconfigured or unreachable shouldn't stop us
  // having recorded their consent — same "best effort" treatment the
  // Stripe webhook already gives these same calls.
  try {
    await upsertMailchimpMember({
      email,
      firstName: customer.firstName ?? undefined,
      lastName: customer.lastName ?? undefined,
      marketingOptIn: true,
      tags: ["newsletter-signup"],
    });
  } catch (err) {
    console.warn("subscribeToNewsletter: Mailchimp sync failed:", err);
  }

  try {
    const resendContactId = await upsertResendContact({
      email,
      firstName: customer.firstName ?? undefined,
      lastName: customer.lastName ?? undefined,
      isCustomer: false,
    });
    if (resendContactId) {
      await prisma.customer.update({ where: { id: customer.id }, data: { resendContactId } });
    }
  } catch (err) {
    console.warn("subscribeToNewsletter: Resend sync failed:", err);
  }

  return { ok: true };
}

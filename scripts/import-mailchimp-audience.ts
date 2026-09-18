/**
 * One-off backfill: pulls every currently-subscribed member of your
 * Mailchimp audience into the `Customer` table (marketingOptIn: true) and
 * syncs each one to Resend as a contact, so they actually receive future
 * campaigns sent from Admin > Campaigns — see
 * src/lib/integrations/resend-broadcasts.ts, whose audience model is
 * entirely `Customer.marketingOptIn = true` rows. Without this, only people
 * who've signed up (or ordered) since the Resend switchover are in that
 * audience; everyone Mailchimp already had is missing.
 *
 * Deliberately conservative — this only ever ADDS consent, never removes
 * it:
 *   - Only imports members with Mailchimp status "subscribed". Unsubscribed,
 *     cleaned, pending, and transactional members are skipped entirely, so
 *     someone who opted out in Mailchimp doesn't get re-subscribed here.
 *   - An existing Customer row (e.g. from a past order) is only ever
 *     upgraded: marketingOptIn true if it wasn't already, missing
 *     first/last name filled in, mailchimpId recorded — nothing that's
 *     already set (a real name from an order, an existing opt-in date) is
 *     overwritten.
 *   - Safe to re-run: every member upserts by email, so a second pass just
 *     confirms/updates rows it already imported rather than duplicating.
 *
 * This is deliberately NOT run automatically anywhere in the app — see
 * README > Resend Broadcasts (campaigns) > "One-off historical import".
 * Run it once, by hand, against your real database and Mailchimp account:
 *
 *   MAILCHIMP_API_KEY="..." \
 *   MAILCHIMP_AUDIENCE_ID="..." \
 *   DATABASE_URL="<Supabase DIRECT connection string>" \
 *   DIRECT_URL="<same>" \
 *   RESEND_API_KEY="..." \
 *   RESEND_FROM_EMAIL="..." \
 *   npx tsx scripts/import-mailchimp-audience.ts
 *
 * (Use the *direct*, non-pooled Supabase connection string, same as
 * `npx prisma migrate deploy` in the README. MAILCHIMP_AUDIENCE_ID is the
 * same audience/list id already used by src/lib/integrations/mailchimp.ts —
 * find it in Mailchimp under Audience > Settings > Audience name and
 * defaults, "Audience ID". RESEND_API_KEY/RESEND_FROM_EMAIL are needed too,
 * so each imported contact can be pushed into Resend's standing segments —
 * without them the Customer rows still get created, but nobody actually
 * receives a campaign until they're synced to Resend some other way.)
 */
import { PrismaClient } from "@prisma/client";
import { upsertResendContact, resendBroadcastsConfigured } from "../src/lib/integrations/resend-broadcasts";

const prisma = new PrismaClient();

function getConfig() {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
  if (!apiKey) throw new Error("Set MAILCHIMP_API_KEY before running this script.");
  if (!audienceId) throw new Error("Set MAILCHIMP_AUDIENCE_ID before running this script.");
  const server = apiKey.split("-").pop();
  if (!server) throw new Error("MAILCHIMP_API_KEY doesn't look right — expected it to end in -usXX.");
  return { apiKey, audienceId, server };
}

function authHeader(apiKey: string) {
  return `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`;
}

type MailchimpMember = {
  id: string;
  email_address: string;
  status: string;
  merge_fields?: { FNAME?: string; LNAME?: string };
  timestamp_opt?: string;
  timestamp_signup?: string;
};

/** Mailchimp paginates at up to 1000 per page — pages through with offset
 * until a page comes back short. */
async function fetchAllMembers(apiKey: string, server: string, audienceId: string): Promise<MailchimpMember[]> {
  const all: MailchimpMember[] = [];
  const count = 1000;
  let offset = 0;
  for (;;) {
    const url =
      `https://${server}.api.mailchimp.com/3.0/lists/${audienceId}/members` +
      `?count=${count}&offset=${offset}` +
      `&fields=members.id,members.email_address,members.status,members.merge_fields,` +
      `members.timestamp_opt,members.timestamp_signup,total_items`;
    const res = await fetch(url, { headers: { Authorization: authHeader(apiKey) } });
    if (!res.ok) {
      throw new Error(`Mailchimp members list failed (${res.status}): ${await res.text()}`);
    }
    const body = (await res.json()) as { members: MailchimpMember[]; total_items: number };
    all.push(...body.members);
    offset += count;
    if (offset >= body.total_items || body.members.length === 0) break;
  }
  return all;
}

async function main() {
  const { apiKey, audienceId, server } = getConfig();
  if (!resendBroadcastsConfigured()) {
    console.warn(
      "Warning: RESEND_API_KEY/RESEND_FROM_EMAIL aren't set — Customer rows will still be created/updated, " +
        "but nothing will be synced to Resend, so imported subscribers won't actually receive campaigns yet."
    );
  }

  console.log("Fetching audience from Mailchimp…");
  const members = await fetchAllMembers(apiKey, server, audienceId);
  console.log(`Found ${members.length} member(s) in the audience.`);

  let imported = 0;
  let updated = 0;
  let resendSynced = 0;
  let skippedNotSubscribed = 0;
  let skippedInvalid = 0;
  let errors = 0;

  for (const m of members) {
    if (m.status !== "subscribed") {
      skippedNotSubscribed++;
      continue;
    }
    const email = m.email_address?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skippedInvalid++;
      continue;
    }

    try {
      const existing = await prisma.customer.findUnique({ where: { email } });
      const optInTimestamp = m.timestamp_opt || m.timestamp_signup;
      const consentAt = optInTimestamp ? new Date(optInTimestamp) : new Date();

      let customer;
      if (existing) {
        customer = await prisma.customer.update({
          where: { email },
          data: {
            marketingOptIn: true,
            marketingConsentAt: existing.marketingConsentAt ?? consentAt,
            firstName: existing.firstName ?? (m.merge_fields?.FNAME || undefined),
            lastName: existing.lastName ?? (m.merge_fields?.LNAME || undefined),
            mailchimpId: existing.mailchimpId ?? m.id,
          },
        });
        updated++;
      } else {
        customer = await prisma.customer.create({
          data: {
            email,
            firstName: m.merge_fields?.FNAME || undefined,
            lastName: m.merge_fields?.LNAME || undefined,
            marketingOptIn: true,
            marketingConsentAt: consentAt,
            mailchimpId: m.id,
          },
        });
        imported++;
      }

      if (resendBroadcastsConfigured()) {
        const hasOrders = (await prisma.order.count({ where: { customerId: customer.id } })) > 0;
        const resendContactId = await upsertResendContact({
          email,
          firstName: customer.firstName ?? undefined,
          lastName: customer.lastName ?? undefined,
          isCustomer: hasOrders,
        });
        if (resendContactId && resendContactId !== customer.resendContactId) {
          await prisma.customer.update({ where: { id: customer.id }, data: { resendContactId } });
        }
        resendSynced++;
      }
    } catch (err) {
      console.warn(`- ${email}: failed —`, err instanceof Error ? err.message : err);
      errors++;
    }

    // A light pause between requests — this only ever runs once by hand,
    // so there's no need to lean on Mailchimp's or Resend's rate limits.
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(
    `\nDone — ${imported} new, ${updated} existing updated, ${resendSynced} synced to Resend, ` +
      `${skippedNotSubscribed} skipped (not subscribed), ${skippedInvalid} skipped (bad email), ${errors} error(s).`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

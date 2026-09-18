/**
 * One-off backfill: pulls every already-sent Mailchimp campaign into the
 * same Campaign table Admin > Campaigns (Resend Broadcasts) writes to, so
 * they show up in the public archive (src/app/archive) alongside anything
 * sent from here on. Safe to re-run — each Mailchimp campaign upserts
 * against its own id (Campaign.mailchimpCampaignId), so a second run just
 * updates rows it already imported rather than duplicating them.
 *
 * This is deliberately NOT run automatically anywhere in the app — see
 * README > Resend Broadcasts (campaigns) > "One-off historical import".
 * Run it once, by hand, against your real database and Mailchimp account:
 *
 *   MAILCHIMP_API_KEY="..." \
 *   DATABASE_URL="<Supabase DIRECT connection string>" \
 *   DIRECT_URL="<same>" \
 *   npx tsx scripts/import-mailchimp-campaigns.ts
 *
 * (Use the *direct*, non-pooled Supabase connection string, same as
 * `npx prisma migrate deploy` in the README — and run
 * `npx prisma migrate deploy` itself first, so the mailchimpCampaignId
 * column this script needs actually exists.)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getConfig() {
  const apiKey = process.env.MAILCHIMP_API_KEY;
  if (!apiKey) {
    throw new Error("Set MAILCHIMP_API_KEY before running this script.");
  }
  const server = apiKey.split("-").pop();
  return { apiKey, server };
}

function authHeader(apiKey: string) {
  return `Basic ${Buffer.from(`anystring:${apiKey}`).toString("base64")}`;
}

type MailchimpCampaign = {
  id: string;
  status: string;
  send_time?: string;
  emails_sent?: number;
  settings?: { subject_line?: string; title?: string };
};

/** Mailchimp paginates at up to 1000 per page — a real account's full sent
 * history can exceed that, so this pages through with offset until a page
 * comes back short. */
async function fetchAllSentCampaigns(apiKey: string, server: string): Promise<MailchimpCampaign[]> {
  const all: MailchimpCampaign[] = [];
  const count = 500;
  let offset = 0;
  for (;;) {
    const url =
      `https://${server}.api.mailchimp.com/3.0/campaigns` +
      `?status=sent&count=${count}&offset=${offset}` +
      `&fields=campaigns.id,campaigns.status,campaigns.send_time,campaigns.emails_sent,campaigns.settings.subject_line,campaigns.settings.title,total_items`;
    const res = await fetch(url, { headers: { Authorization: authHeader(apiKey) } });
    if (!res.ok) {
      throw new Error(`Mailchimp campaigns list failed (${res.status}): ${await res.text()}`);
    }
    const body = (await res.json()) as { campaigns: MailchimpCampaign[]; total_items: number };
    all.push(...body.campaigns);
    offset += count;
    if (offset >= body.total_items || body.campaigns.length === 0) break;
  }
  return all;
}

async function fetchCampaignHtml(apiKey: string, server: string, campaignId: string): Promise<string | null> {
  const res = await fetch(`https://${server}.api.mailchimp.com/3.0/campaigns/${campaignId}/content`, {
    headers: { Authorization: authHeader(apiKey) },
  });
  if (!res.ok) {
    console.warn(`  content fetch failed (${res.status}) — skipping`);
    return null;
  }
  const body = (await res.json()) as { html?: string };
  return body.html && body.html.trim() ? body.html : null;
}

async function main() {
  const { apiKey, server } = getConfig();
  if (!server) throw new Error("MAILCHIMP_API_KEY doesn't look right — expected it to end in -usXX.");

  console.log("Fetching sent campaign list from Mailchimp…");
  const campaigns = await fetchAllSentCampaigns(apiKey, server);
  console.log(`Found ${campaigns.length} sent campaign(s).`);

  let imported = 0;
  let skipped = 0;

  for (const c of campaigns) {
    const subject = c.settings?.subject_line?.trim() || c.settings?.title?.trim();
    if (!subject) {
      console.warn(`- ${c.id}: no subject line — skipping`);
      skipped++;
      continue;
    }

    console.log(`- ${c.id}: "${subject}"`);
    let html: string | null;
    try {
      html = await fetchCampaignHtml(apiKey, server, c.id);
    } catch (err) {
      console.warn(`  content fetch errored — skipping:`, err instanceof Error ? err.message : err);
      skipped++;
      continue;
    }
    if (!html) {
      skipped++;
      continue;
    }

    await prisma.campaign.upsert({
      where: { mailchimpCampaignId: c.id },
      update: {
        subject,
        html,
        sentAt: c.send_time ? new Date(c.send_time) : undefined,
        recipientCount: c.emails_sent ?? undefined,
      },
      create: {
        subject,
        html,
        audience: "ALL", // Mailchimp's own segment for that send isn't something we can map back to ours
        status: "SENT",
        sentAt: c.send_time ? new Date(c.send_time) : new Date(),
        recipientCount: c.emails_sent ?? null,
        mailchimpCampaignId: c.id,
      },
    });
    imported++;

    // A light pause between requests — this only ever runs once by hand,
    // so there's no need to lean on Mailchimp's rate limit.
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log(`\nDone — imported/updated ${imported}, skipped ${skipped} (no subject or no content).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

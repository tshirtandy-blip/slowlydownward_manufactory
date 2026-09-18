// Content-block definitions for the campaign email builder (Admin >
// Campaigns > compose). Mirrors the pattern in src/lib/blocks.ts (the
// storefront page builder) — an ordered array of typed blocks, stored as
// JSON on Campaign.blocks, validated by the zod schemas below on save. The
// block set is deliberately smaller than the page builder's: just what a
// newsletter needs (a header, images one-across or two-across, an action
// button, social links), matching the old Mailchimp campaigns this
// replaces — see src/lib/campaignRender.ts for how these render to actual
// email-safe HTML.
import { z } from "zod";

const idField = z.string().min(1);

export const campaignHeaderBlockSchema = z.object({
  id: idField,
  type: z.literal("header"),
  eyebrow: z.string().optional(),
  heading: z.string(),
  subheading: z.string().optional(),
});

export const campaignTextBlockSchema = z.object({
  id: idField,
  type: z.literal("text"),
  body: z.string(),
});

const imageSideSchema = z.object({
  imageUrl: z.string(),
  caption: z.string().optional(),
  href: z.string().optional(),
});

export const campaignImageBlockSchema = z.object({
  id: idField,
  type: z.literal("image"),
  imageUrl: z.string(),
  caption: z.string().optional(),
  href: z.string().optional(),
});

export const campaignImageTwoUpBlockSchema = z.object({
  id: idField,
  type: z.literal("imageTwoUp"),
  left: imageSideSchema,
  right: imageSideSchema,
});

export const campaignButtonBlockSchema = z.object({
  id: idField,
  type: z.literal("button"),
  label: z.string(),
  href: z.string(),
});

export const campaignSocialBlockSchema = z.object({
  id: idField,
  type: z.literal("social"),
  heading: z.string().optional(),
});

export const campaignSpacerBlockSchema = z.object({
  id: idField,
  type: z.literal("spacer"),
  size: z.enum(["sm", "md", "lg"]),
});

export const campaignDividerBlockSchema = z.object({
  id: idField,
  type: z.literal("divider"),
});

export const campaignBlockSchema = z.discriminatedUnion("type", [
  campaignHeaderBlockSchema,
  campaignTextBlockSchema,
  campaignImageBlockSchema,
  campaignImageTwoUpBlockSchema,
  campaignButtonBlockSchema,
  campaignSocialBlockSchema,
  campaignSpacerBlockSchema,
  campaignDividerBlockSchema,
]);

export const campaignBlocksArraySchema = z.array(campaignBlockSchema);

export type CampaignBlock = z.infer<typeof campaignBlockSchema>;
export type CampaignBlockType = CampaignBlock["type"];
export type CampaignImageSide = z.infer<typeof imageSideSchema>;

export const CAMPAIGN_BLOCK_DEFS: Record<CampaignBlockType, { label: string }> = {
  header: { label: "Header" },
  text: { label: "Text" },
  image: { label: "Image (one across)" },
  imageTwoUp: { label: "Images (two across)" },
  button: { label: "Action button" },
  social: { label: "Social links" },
  spacer: { label: "Spacer" },
  divider: { label: "Divider" },
};

// Order the "add block" menu is presented in.
export const CAMPAIGN_BLOCK_TYPES: CampaignBlockType[] = [
  "header",
  "text",
  "image",
  "imageTwoUp",
  "button",
  "social",
  "divider",
  "spacer",
];

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `blk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** A sensible default block of the given type, ready to drop into the editor. */
export function createCampaignBlock(type: CampaignBlockType): CampaignBlock {
  const id = newId();
  switch (type) {
    case "header":
      return { id, type, heading: "Your heading here" };
    case "text":
      return { id, type, body: "Write something here." };
    case "image":
      return { id, type, imageUrl: "" };
    case "imageTwoUp":
      return { id, type, left: { imageUrl: "" }, right: { imageUrl: "" } };
    case "button":
      return { id, type, label: "Shop now", href: "https://" };
    case "social":
      return { id, type };
    case "spacer":
      return { id, type, size: "md" };
    case "divider":
      return { id, type };
  }
}

/**
 * Safely parses blocks JSON as it comes back from the database, tolerating
 * missing/null/legacy-shaped data by returning an empty array rather than
 * throwing — a campaign that predates this feature (or was never edited
 * with the new builder) just has no blocks yet; see blocksFromLegacyHtml
 * for what the compose page falls back to in that case.
 */
export function parseCampaignBlocks(value: unknown): CampaignBlock[] {
  const result = campaignBlocksArraySchema.safeParse(value);
  return result.success ? result.data : [];
}

/**
 * A draft written before this builder existed (or an old-style import) has
 * real content in Campaign.html but an empty Campaign.blocks array — rather
 * than showing an empty builder and losing that content, wrap it as a
 * single legacy "text" block so it's still there, still editable, and still
 * gets sanitized on the next save like any other text block.
 */
export function blocksFromLegacyHtml(html: string): CampaignBlock[] {
  return html.trim() ? [{ id: "legacy", type: "text", body: html }] : [];
}

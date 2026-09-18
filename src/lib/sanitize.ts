import sanitizeHtml from "sanitize-html";
import type { Block } from "@/lib/blocks";
import type { CampaignBlock } from "@/lib/campaignBlocks";

/**
 * Sanitizes rich text coming out of the admin's block editor (RichTextEditor)
 * before it's ever written to the database. This content ends up on public
 * storefront pages, viewed by customers — so even though only an Admin can
 * author it, we strip everything outside a small allowlist of formatting
 * tags. That's defence in depth against a compromised admin session being
 * used to plant a stored-XSS payload that would then run in every visitor's
 * browser.
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["b", "strong", "i", "em", "u", "p", "div", "br", "ul", "ol", "li", "a"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  }).trim();
}

/** Runs every rich-text body field in a block list through sanitizeRichText.
 * Called right before any block list is written to the database — the one
 * choke point every save path (Page.blocks, Print.contentBlocks) goes
 * through, however the blocks were authored. */
export function sanitizeBlocks(blocks: Block[]): Block[] {
  return blocks.map((block) =>
    block.type === "text" || block.type === "imageText"
      ? { ...block, body: sanitizeRichText(block.body) }
      : block
  );
}

/** Same idea as sanitizeBlocks, for the campaign email builder
 * (src/lib/campaignBlocks.ts) — only its "text" block carries rich-text
 * HTML from RichTextEditor; every other block's fields are plain strings
 * (escaped separately at render time in src/lib/campaignRender.ts). Called
 * from saveCampaignDraft, the one place a campaign's blocks are ever
 * written. */
export function sanitizeCampaignBlocks(blocks: CampaignBlock[]): CampaignBlock[] {
  return blocks.map((block) => (block.type === "text" ? { ...block, body: sanitizeRichText(block.body) } : block));
}

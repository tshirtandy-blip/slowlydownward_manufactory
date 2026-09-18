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

/**
 * Sanitizes a Certificate of Authenticity template's owner-authored HTML
 * (CoaTemplate.bodyHtml — see src/lib/coa-template.ts and
 * src/components/admin/CoaTemplateEditor.tsx) before it's written to the
 * database. This is a much wider allowlist than sanitizeRichText's above,
 * since a COA template is a genuinely free-form HTML/CSS layout (images,
 * headings, tables, styled boxes), not just a formatted paragraph — but
 * the same defence-in-depth reasoning applies: only an Admin can author
 * one, but scripts, event handlers, and non-http(s)/data URLs are still
 * stripped so a compromised admin session can't plant something that runs
 * when a packer's browser later renders this template's live preview or
 * opens the generated PDF.
 */
export function sanitizeCoaHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "div", "span", "p", "br", "hr",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "b", "strong", "i", "em", "u", "small",
      "ul", "ol", "li",
      "table", "thead", "tbody", "tr", "td", "th",
      "img", "a",
    ],
    allowedAttributes: {
      "*": ["class", "id", "style", "align"],
      img: ["src", "alt", "width", "height"],
      a: ["href", "target", "rel"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https", "data"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  }).trim();
}

/** CoaTemplate.css is plain CSS text, not HTML, so sanitizeHtml doesn't
 * apply — but it does get interpolated verbatim inside a literal
 * `<style>...</style>` block both server-side (src/lib/coa-pdf.ts) and in
 * the template editor's client-side live preview (CoaTemplateEditor.tsx),
 * so the one thing worth stripping is a "</style" sequence that could
 * otherwise close that block early and smuggle in real markup/script —
 * same defence-in-depth reasoning as sanitizeCoaHtml above. Not a full CSS
 * parser/validator; modern browsers don't execute script from CSS values
 * (old `expression()`/`javascript:` url() tricks are IE-only and long
 * dead), so this is the one realistic injection vector worth closing.
 */
export function sanitizeCoaCss(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style").trim();
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

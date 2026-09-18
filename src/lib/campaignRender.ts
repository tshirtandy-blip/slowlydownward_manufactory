// Renders a campaign's content blocks (src/lib/campaignBlocks.ts) to a
// single email-safe HTML string — table-based where email clients actually
// need it (the two-up image layout; Outlook desktop has no flexbox/grid
// support), plain inline-styled divs/paragraphs everywhere else, matching
// the same look (Georgia serif, #1a1a1a ink, #6b6558 stone, #e5e0d8 line,
// uppercase letter-spaced buttons) already used by src/lib/email-templates.ts
// and the campaign wrapper in Admin > Campaigns > actions.ts. The result is
// stored as Campaign.html so every existing send/preview/test path — which
// only ever reads campaign.html — keeps working unchanged.
import type { CampaignBlock, CampaignImageSide } from "@/lib/campaignBlocks";
import type { SocialLinkItem } from "@/lib/footer";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Block href/image-url fields are plain text inputs (not run through
// sanitizeRichText the way the "text" block's rich body is), so a
// javascript: URL typed or pasted in there is guarded against here rather
// than trusted as-is.
function safeHref(href: string): string {
  const trimmed = href.trim();
  if (/^(https?:|mailto:|tel:|\/)/i.test(trimmed)) return trimmed;
  return "#";
}

function renderHeader(block: Extract<CampaignBlock, { type: "header" }>): string {
  const eyebrow = block.eyebrow?.trim()
    ? `<p style="margin:0 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6b6558;">${escapeHtml(
        block.eyebrow
      )}</p>`
    : "";
  const subheading = block.subheading?.trim()
    ? `<p style="margin:8px 0 0;font-size:14px;color:#6b6558;">${escapeHtml(block.subheading)}</p>`
    : "";
  return `<div style="text-align:center;margin:0 0 28px;">${eyebrow}<h1 style="margin:0;font-size:24px;font-weight:normal;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;">${escapeHtml(
    block.heading
  )}</h1>${subheading}</div>`;
}

function renderText(block: Extract<CampaignBlock, { type: "text" }>): string {
  // block.body is already sanitizeRichText()'d before it's ever saved (see
  // sanitizeCampaignBlocks in src/lib/sanitize.ts) — same trust level the
  // old single rich-text field had, safe to inline as-is.
  if (!block.body.trim()) return "";
  return `<div style="margin:0 0 24px;font-size:15px;line-height:1.6;">${block.body}</div>`;
}

function renderImageSide(side: CampaignImageSide): string {
  if (!side.imageUrl) return "";
  const img = `<img src="${escapeHtml(side.imageUrl)}" alt="${escapeHtml(
    side.caption ?? ""
  )}" style="display:block;width:100%;max-width:100%;height:auto;border:0;" />`;
  const linked = side.href?.trim() ? `<a href="${escapeHtml(safeHref(side.href))}">${img}</a>` : img;
  const caption = side.caption?.trim()
    ? `<p style="margin:8px 0 0;font-size:12px;color:#6b6558;text-align:center;">${escapeHtml(side.caption)}</p>`
    : "";
  return linked + caption;
}

function renderImage(block: Extract<CampaignBlock, { type: "image" }>): string {
  const inner = renderImageSide(block);
  if (!inner) return "";
  return `<div style="margin:0 0 24px;">${inner}</div>`;
}

function renderImageTwoUp(block: Extract<CampaignBlock, { type: "imageTwoUp" }>): string {
  const leftInner = renderImageSide(block.left);
  const rightInner = renderImageSide(block.right);
  if (!leftInner && !rightInner) return "";
  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;"><tr><td style="width:50%;padding:0 8px 0 0;" valign="top">${leftInner}</td><td style="width:50%;padding:0 0 0 8px;" valign="top">${rightInner}</td></tr></table>`;
}

function renderButton(block: Extract<CampaignBlock, { type: "button" }>): string {
  if (!block.label.trim()) return "";
  return `<p style="text-align:center;margin:0 0 28px;"><a href="${escapeHtml(
    safeHref(block.href)
  )}" style="background:#1a1a1a;color:#fdfaf4;padding:14px 28px;text-decoration:none;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;display:inline-block;">${escapeHtml(
    block.label
  )}</a></p>`;
}

function renderSocial(block: Extract<CampaignBlock, { type: "social" }>, socialLinks: SocialLinkItem[]): string {
  if (socialLinks.length === 0) return "";
  const heading = block.heading?.trim()
    ? `<p style="margin:0 0 10px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6b6558;">${escapeHtml(
        block.heading
      )}</p>`
    : "";
  const links = socialLinks
    .map(
      (s) =>
        `<a href="${escapeHtml(safeHref(s.url))}" style="color:#1a1a1a;text-decoration:underline;margin:0 8px;font-size:13px;">${escapeHtml(
          s.platform
        )}</a>`
    )
    .join("");
  return `<div style="text-align:center;margin:0 0 28px;">${heading}<p style="margin:0;">${links}</p></div>`;
}

function renderSpacer(block: Extract<CampaignBlock, { type: "spacer" }>): string {
  const height = block.size === "sm" ? 12 : block.size === "lg" ? 48 : 24;
  return `<div style="height:${height}px;line-height:${height}px;font-size:1px;">&nbsp;</div>`;
}

function renderDivider(): string {
  return `<hr style="border:none;border-top:1px solid #e5e0d8;margin:0 0 24px;" />`;
}

export function renderCampaignBlocksToHtml(blocks: CampaignBlock[], opts: { socialLinks: SocialLinkItem[] }): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "header":
          return renderHeader(block);
        case "text":
          return renderText(block);
        case "image":
          return renderImage(block);
        case "imageTwoUp":
          return renderImageTwoUp(block);
        case "button":
          return renderButton(block);
        case "social":
          return renderSocial(block, opts.socialLinks);
        case "spacer":
          return renderSpacer(block);
        case "divider":
          return renderDivider();
        default:
          return "";
      }
    })
    .join("");
}

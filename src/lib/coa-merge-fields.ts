/**
 * The fixed set of {{token}} placeholders a Certificate of Authenticity
 * template can use, plus the plain substitution function that fills them
 * in. Deliberately has NO server-only imports (no Prisma) so it can be
 * shared by both the client-side template editor (CoaTemplateEditor.tsx —
 * its live iframe preview substitutes SAMPLE_COA_VALUES) and the
 * server-side generator (coa-template.ts's substituteMergeFields, which
 * builds real values from an order/edition and calls substituteTokens
 * below).
 */

export const COA_MERGE_FIELDS: { token: string; label: string }[] = [
  { token: "printTitle", label: "Print title" },
  { token: "artist", label: "Artist" },
  { token: "editionNumber", label: "Edition number" },
  { token: "editionSize", label: "Edition size" },
  { token: "paperSize", label: "Paper size" },
  { token: "printSize", label: "Print size" },
  { token: "orderNumber", label: "Order number" },
  { token: "customerName", label: "Customer name" },
  { token: "date", label: "Date" },
  { token: "primaryImageUrl", label: "Product image URL (use inside an <img src>)" },
];

export const DEFAULT_COA_BODY_HTML = `<div class="coa">
  <h1>Certificate of Authenticity</h1>
  <img class="coa-image" src="{{primaryImageUrl}}" alt="" />
  <h2>{{printTitle}}</h2>
  <p class="coa-artist">{{artist}}</p>
  <p class="coa-edition">Edition {{editionNumber}} of {{editionSize}}</p>
  <p class="coa-specs">{{paperSize}} &mdash; {{printSize}}</p>
  <p class="coa-footer">Order {{orderNumber}} &middot; {{date}}</p>
</div>`;

export const DEFAULT_COA_CSS = `.coa { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; padding: 40px; text-align: center; }
.coa h1 { font-size: 18px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0 0 28px; }
.coa-image { max-width: 55%; max-height: 240px; object-fit: contain; margin: 0 auto 24px; display: block; }
.coa h2 { font-size: 20px; margin: 4px 0; font-weight: normal; }
.coa-artist { margin: 0 0 16px; color: #555; }
.coa-edition { font-size: 16px; font-weight: bold; margin: 16px 0; }
.coa-specs { color: #555; font-size: 12px; }
.coa-footer { margin-top: 36px; font-size: 11px; color: #888; }`;

export const COA_PAGE_SIZES = ["A4", "A5", "Letter"] as const;
export type CoaPageSize = (typeof COA_PAGE_SIZES)[number];

/** Fake data for the Settings editor's live preview and "Preview PDF"
 * button — never written to the database, just realistic enough to show
 * an owner what a real certificate will look like. */
export const SAMPLE_COA_VALUES: Record<string, string> = {
  printTitle: "Iron Meander, West",
  artist: "Stanley Donwood",
  editionNumber: "47",
  editionSize: "200",
  paperSize: "A2 (420 x 594mm)",
  printSize: "300 x 400mm",
  orderNumber: "SD26-1234",
  customerName: "A. Sample Customer",
  date: new Date().toLocaleDateString("en-GB"),
  primaryImageUrl:
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="100%" height="100%" fill="#e5e0d8"/><text x="50%" y="50%" font-family="sans-serif" font-size="18" fill="#8a8378" text-anchor="middle">Sample print image</text></svg>'
    ),
};

/** Replaces every {{token}} in an owner-authored template with a value
 * from `values`. Unknown tokens are left untouched (so a typo shows up as
 * literal "{{typo}}" text rather than silently vanishing). */
export function substituteTokens(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token) => (token in values ? values[token] : match));
}

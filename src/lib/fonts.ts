// Curated list of typefaces the store owner can choose between in Admin >
// Settings > Typography, for headings/titles and for body text separately.
// Every option here is a "system stack" — real fonts already installed on
// customers' computers/phones — so there's nothing to load or license, and
// the site never has a flash of missing text while a web font downloads.
// Admin-uploaded custom fonts (see CustomFont below) work differently — see
// the second half of this file.
//
// The `key` is what's stored on SiteSettings.headingFont / .bodyFont; the
// `stack` is the actual CSS font-family value applied via a CSS variable
// (see src/app/layout.tsx and tailwind.config.ts).
export const FONT_OPTIONS = [
  {
    key: "serif-times",
    label: "Times New Roman (serif)",
    stack: "'Times New Roman', Georgia, 'Liberation Serif', serif",
  },
  {
    key: "serif-georgia",
    label: "Georgia (serif)",
    stack: "Georgia, 'Times New Roman', 'Liberation Serif', serif",
  },
  {
    key: "serif-garamond",
    label: "Garamond (serif)",
    stack: "Garamond, Baskerville, 'Times New Roman', serif",
  },
  {
    key: "serif-palatino",
    label: "Palatino (serif)",
    stack: "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif",
  },
  {
    key: "serif-baskerville",
    label: "Baskerville (serif)",
    stack: "Baskerville, 'Baskerville Old Face', Garamond, 'Times New Roman', serif",
  },
  {
    key: "serif-book-antiqua",
    label: "Book Antiqua (serif)",
    stack: "'Book Antiqua', Palatino, Georgia, serif",
  },
  {
    key: "serif-didot",
    label: "Didot (serif, display)",
    stack: "Didot, 'Bodoni MT', 'Book Antiqua', 'Times New Roman', serif",
  },
  {
    key: "sans-helvetica",
    label: "Helvetica (sans-serif)",
    stack: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  {
    key: "sans-arial",
    label: "Arial (sans-serif)",
    stack: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
  },
  {
    key: "sans-avenir",
    label: "Avenir (sans-serif)",
    stack: "Avenir, 'Avenir Next', 'Helvetica Neue', sans-serif",
  },
  {
    key: "sans-verdana",
    label: "Verdana (sans-serif)",
    stack: "Verdana, Geneva, Arial, sans-serif",
  },
  {
    key: "sans-trebuchet",
    label: "Trebuchet MS (sans-serif)",
    stack: "'Trebuchet MS', 'Lucida Grande', Arial, sans-serif",
  },
  {
    key: "sans-gill-sans",
    label: "Gill Sans (sans-serif)",
    stack: "'Gill Sans', 'Gill Sans MT', Calibri, Arial, sans-serif",
  },
  {
    key: "sans-futura",
    label: "Futura (sans-serif, display)",
    stack: "Futura, 'Century Gothic', 'Helvetica Neue', sans-serif",
  },
  {
    key: "sans-century-gothic",
    label: "Century Gothic (sans-serif)",
    stack: "'Century Gothic', Futura, 'Helvetica Neue', sans-serif",
  },
  {
    key: "sans-optima",
    label: "Optima (sans-serif)",
    stack: "Optima, Candara, 'Helvetica Neue', sans-serif",
  },
  {
    key: "display-copperplate",
    label: "Copperplate (display)",
    stack: "Copperplate, 'Copperplate Gothic Light', Georgia, serif",
  },
  {
    key: "mono-courier",
    label: "Courier (monospace)",
    stack: "'Courier New', Courier, monospace",
  },
  {
    key: "mono-consolas",
    label: "Consolas (monospace)",
    stack: "Consolas, 'Courier New', monospace",
  },
] as const;

export type FontKey = (typeof FONT_OPTIONS)[number]["key"];

const DEFAULT_STACK = FONT_OPTIONS[0].stack;

// --- Admin-uploaded custom fonts -------------------------------------------
// A font someone actually owns the rights to (a bought/licensed brand
// typeface) and uploads as a file — see Admin > Settings > Typography >
// Custom fonts, src/lib/custom-fonts.ts, and the CustomFont Prisma model.
// Unlike the system stacks above, these need an actual @font-face rule
// pointing at the uploaded file before the browser knows what the name
// means — see fontFaceCssFor below, used once in src/app/layout.tsx.

export type CustomFontOption = {
  id: string;
  label: string;
  fileUrl: string;
  format: string; // "woff2" | "woff" | "truetype" | "opentype"
  fallback: string; // a generic CSS family: serif | sans-serif | monospace | system-ui
};

const CUSTOM_FONT_PREFIX = "custom-";

export function customFontKey(id: string): string {
  return `${CUSTOM_FONT_PREFIX}${id}`;
}

export function isCustomFontKey(key: string): boolean {
  return key.startsWith(CUSTOM_FONT_PREFIX);
}

// The CSS font-family name declared by this custom font's @font-face rule.
// Namespaced and quoted wherever it's used so it can never collide with a
// real system font of the same chosen label.
export function customFontFamilyName(id: string): string {
  return `Custom Font ${id}`;
}

/** Resolves a stored SiteSettings.headingFont/.bodyFont value into the real
 * CSS font-family stack to apply — a built-in system stack, or an uploaded
 * custom font's own family name (falling back quietly to the default stack
 * if it's since been deleted). */
export function fontStackFor(key: string, customFonts: CustomFontOption[] = []): string {
  if (isCustomFontKey(key)) {
    const id = key.slice(CUSTOM_FONT_PREFIX.length);
    const custom = customFonts.find((f) => f.id === id);
    if (!custom) return DEFAULT_STACK; // referenced font was deleted since
    return `"${customFontFamilyName(custom.id)}", ${custom.fallback}`;
  }
  return FONT_OPTIONS.find((f) => f.key === key)?.stack ?? DEFAULT_STACK;
}

/** The @font-face CSS needed for every uploaded custom font, so the browser
 * knows where to actually fetch it from — see src/app/layout.tsx, which
 * renders this once, site-wide. */
export function fontFaceCssFor(customFonts: CustomFontOption[]): string {
  return customFonts
    .map(
      (f) =>
        `@font-face { font-family: "${customFontFamilyName(f.id)}"; src: url("${f.fileUrl}") format("${f.format}"); font-display: swap; }`
    )
    .join("\n");
}

// Shared content-block definitions for the storefront page builder.
//
// A "page" (the home page, or any standalone page under /<slug>, or the
// extra content on a print's product page) is just an ordered array of
// these blocks, stored as JSON. This file is the single source of truth for
// their shape: the zod schemas both validate what the admin editor saves
// and give us the `Block` TypeScript type via z.infer, so the type and the
// runtime check can never drift apart.
import { z } from "zod";

const idField = z.string().min(1);

export const heroBlockSchema = z.object({
  id: idField,
  type: z.literal("hero"),
  eyebrow: z.string().optional(),
  heading: z.string(),
  subheading: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const textBlockSchema = z.object({
  id: idField,
  type: z.literal("text"),
  body: z.string(),
});

export const imageBlockSchema = z.object({
  id: idField,
  type: z.literal("image"),
  imageUrl: z.string(),
  caption: z.string().optional(),
  width: z.enum(["normal", "wide", "full"]).optional(),
});

export const imageTextBlockSchema = z.object({
  id: idField,
  type: z.literal("imageText"),
  imageUrl: z.string(),
  imagePosition: z.enum(["left", "right"]),
  heading: z.string().optional(),
  body: z.string(),
});

export const galleryBlockSchema = z.object({
  id: idField,
  type: z.literal("gallery"),
  images: z.array(z.object({ url: z.string(), caption: z.string().optional() })),
});

export const quoteBlockSchema = z.object({
  id: idField,
  type: z.literal("quote"),
  text: z.string(),
  attribution: z.string().optional(),
});

export const buttonBlockSchema = z.object({
  id: idField,
  type: z.literal("button"),
  label: z.string(),
  href: z.string(),
});

export const spacerBlockSchema = z.object({
  id: idField,
  type: z.literal("spacer"),
  size: z.enum(["sm", "md", "lg"]),
});

export const printGridBlockSchema = z.object({
  id: idField,
  type: z.literal("printGrid"),
  heading: z.string().optional(),
  mode: z.enum(["all", "collection", "selected"]),
  collectionId: z.string().optional(),
  printIds: z.array(z.string()).optional(),
  limit: z.number().optional(),
});

export const blockSchema = z.discriminatedUnion("type", [
  heroBlockSchema,
  textBlockSchema,
  imageBlockSchema,
  imageTextBlockSchema,
  galleryBlockSchema,
  quoteBlockSchema,
  buttonBlockSchema,
  spacerBlockSchema,
  printGridBlockSchema,
]);

export const blocksArraySchema = z.array(blockSchema);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type PrintGridBlock = z.infer<typeof printGridBlockSchema>;

export type PrintOption = { id: string; title: string };
export type CollectionOption = { id: string; title: string };

export const BLOCK_DEFS: Record<BlockType, { label: string }> = {
  hero: { label: "Hero heading" },
  text: { label: "Text" },
  image: { label: "Image" },
  imageText: { label: "Image + text" },
  gallery: { label: "Image gallery" },
  quote: { label: "Quote" },
  button: { label: "Button / link" },
  spacer: { label: "Spacer" },
  printGrid: { label: "Print grid" },
};

// Order the "add block" menu is presented in.
export const BLOCK_TYPES: BlockType[] = [
  "hero",
  "text",
  "imageText",
  "image",
  "gallery",
  "quote",
  "printGrid",
  "button",
  "spacer",
];

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `blk_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** A sensible default block of the given type, ready to drop into the editor. */
export function createBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case "hero":
      return { id, type, heading: "New heading" };
    case "text":
      return { id, type, body: "Write something here." };
    case "image":
      return { id, type, imageUrl: "", width: "normal" };
    case "imageText":
      return { id, type, imageUrl: "", imagePosition: "left", body: "Write something here." };
    case "gallery":
      return { id, type, images: [] };
    case "quote":
      return { id, type, text: "A short quote." };
    case "button":
      return { id, type, label: "Learn more", href: "/" };
    case "spacer":
      return { id, type, size: "md" };
    case "printGrid":
      return { id, type, mode: "all" };
  }
}

/**
 * Safely parses blocks JSON as it comes back from the database, tolerating
 * missing/null/legacy-shaped data by returning an empty page rather than
 * throwing — a storefront page should never 500 because of bad JSON.
 */
export function parseBlocks(value: unknown): Block[] {
  const result = blocksArraySchema.safeParse(value);
  return result.success ? result.data : [];
}

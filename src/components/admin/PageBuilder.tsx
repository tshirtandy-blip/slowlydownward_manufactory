"use client";

import { useState, useTransition } from "react";
import {
  BLOCK_DEFS,
  BLOCK_TYPES,
  createBlock,
  type Block,
  type BlockType,
  type PrintOption,
  type CollectionOption,
} from "@/lib/blocks";
import { savePageBlocks } from "@/app/admin/(protected)/pages/actions";
import { savePrintContentBlocks } from "@/app/admin/(protected)/pages/products/actions";
import { ImageDropzone } from "@/components/admin/ImageDropzone";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-caps block mb-2">{label}</label>
      {children}
    </div>
  );
}

/**
 * The block editor used for the home page, standalone pages, and a print's
 * extra product-page content. `target` says which server action to save
 * through — the two are kept separate (Page.blocks vs Print.contentBlocks)
 * but share this exact same editing UI.
 */
export function PageBuilder({
  target,
  initialBlocks,
  prints,
  collections,
}: {
  target: { kind: "page"; id: string } | { kind: "print"; id: string };
  initialBlocks: Block[];
  prints: PrintOption[];
  collections: CollectionOption[];
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [addType, setAddType] = useState<BlockType>("text");
  const [error, setError] = useState<string | null>(null);

  function update(next: Block[]) {
    setBlocks(next);
    setDirty(true);
    setJustSaved(false);
  }

  function updateBlock(index: number, patch: Record<string, unknown>) {
    update(blocks.map((b, i) => (i === index ? ({ ...b, ...patch } as Block) : b)));
  }

  function removeBlock(index: number) {
    update(blocks.filter((_, i) => i !== index));
  }

  function duplicateBlock(index: number) {
    const source = blocks[index];
    const copy: Block = { ...source, id: `${source.id}-copy-${Date.now()}` };
    const next = blocks.slice();
    next.splice(index + 1, 0, copy);
    update(next);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const next = blocks.slice();
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    update(next);
  }

  function addBlock() {
    update([...blocks, createBlock(addType)]);
  }

  function handleDrop(index: number) {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      return;
    }
    const next = blocks.slice();
    const [item] = next.splice(dragIndex, 1);
    next.splice(index, 0, item);
    setDragIndex(null);
    update(next);
  }

  function save() {
    setError(null);
    startSaving(async () => {
      try {
        if (target.kind === "page") {
          await savePageBlocks(target.id, blocks);
        } else {
          await savePrintContentBlocks(target.id, blocks);
        }
        setDirty(false);
        setJustSaved(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save — please try again.");
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 sticky top-0 bg-paper py-3 z-10 border-b hairline">
        <p className="label-caps">
          {blocks.length} block{blocks.length === 1 ? "" : "s"}
          {dirty && " · unsaved changes"}
        </p>
        <div className="flex items-center gap-4">
          {error && <p className="text-xs text-accent">{error}</p>}
          <button onClick={save} disabled={saving || !dirty} className="btn-primary disabled:opacity-40">
            {saving ? "Saving…" : !dirty && justSaved ? "Saved" : "Save changes"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {blocks.map((block, i) => (
          <div
            key={block.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            className="border hairline bg-white"
          >
            <div
              draggable
              onDragStart={() => setDragIndex(i)}
              className="flex items-center justify-between px-4 py-2 border-b hairline bg-line/40 cursor-move select-none"
            >
              <span className="label-caps">⠿ {BLOCK_DEFS[block.type].label}</span>
              <div className="flex items-center gap-3 text-xs">
                <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0} className="text-stone hover:text-ink disabled:opacity-30">
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(i, 1)}
                  disabled={i === blocks.length - 1}
                  className="text-stone hover:text-ink disabled:opacity-30"
                >
                  ↓
                </button>
                <button type="button" onClick={() => duplicateBlock(i)} className="text-stone hover:text-ink">
                  Duplicate
                </button>
                <button type="button" onClick={() => removeBlock(i)} className="text-stone hover:text-accent">
                  Delete
                </button>
              </div>
            </div>
            <div className="p-4">
              <BlockFields block={block} onChange={(patch) => updateBlock(i, patch)} prints={prints} collections={collections} />
            </div>
          </div>
        ))}

        {blocks.length === 0 && (
          <p className="text-stone text-sm py-12 text-center border hairline border-dashed">
            No content blocks yet — add one below.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 mt-6 pt-6 border-t hairline">
        <select value={addType} onChange={(e) => setAddType(e.target.value as BlockType)} className={inputClass + " max-w-[220px]"}>
          {BLOCK_TYPES.map((type) => (
            <option key={type} value={type}>
              {BLOCK_DEFS[type].label}
            </option>
          ))}
        </select>
        <button type="button" onClick={addBlock} className="btn-secondary">
          + Add block
        </button>
      </div>
    </div>
  );
}

function BlockFields({
  block,
  onChange,
  prints,
  collections,
}: {
  block: Block;
  onChange: (patch: Record<string, unknown>) => void;
  prints: PrintOption[];
  collections: CollectionOption[];
}) {
  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-4">
          <Field label="Eyebrow (small caps line above the heading)">
            <input value={block.eyebrow ?? ""} onChange={(e) => onChange({ eyebrow: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Heading">
            <input value={block.heading} onChange={(e) => onChange({ heading: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Subheading">
            <textarea value={block.subheading ?? ""} onChange={(e) => onChange({ subheading: e.target.value })} rows={2} className={inputClass} />
          </Field>
          <ImageDropzone
            value={block.imageUrl ?? ""}
            onChange={(url) => onChange({ imageUrl: url })}
            label="Banner image (optional)"
          />
        </div>
      );

    case "text":
      return (
        <Field label="Text">
          <RichTextEditor value={block.body} onChange={(html) => onChange({ body: html })} />
        </Field>
      );

    case "image":
      return (
        <div className="space-y-4">
          <ImageDropzone value={block.imageUrl} onChange={(url) => onChange({ imageUrl: url })} label="Image" />
          <Field label="Caption (optional)">
            <input value={block.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Width">
            <select value={block.width ?? "normal"} onChange={(e) => onChange({ width: e.target.value })} className={inputClass}>
              <option value="normal">Normal</option>
              <option value="wide">Wide</option>
              <option value="full">Full width</option>
            </select>
          </Field>
        </div>
      );

    case "imageText":
      return (
        <div className="space-y-4">
          <ImageDropzone value={block.imageUrl} onChange={(url) => onChange({ imageUrl: url })} label="Image" />
          <Field label="Image position">
            <select value={block.imagePosition} onChange={(e) => onChange({ imagePosition: e.target.value })} className={inputClass}>
              <option value="left">Image on left</option>
              <option value="right">Image on right</option>
            </select>
          </Field>
          <Field label="Heading (optional)">
            <input value={block.heading ?? ""} onChange={(e) => onChange({ heading: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Text">
            <RichTextEditor value={block.body} onChange={(html) => onChange({ body: html })} />
          </Field>
        </div>
      );

    case "gallery": {
      const images = block.images;
      return (
        <div className="space-y-4">
          {images.map((img, i) => (
            <div key={i} className="border hairline p-3">
              <ImageDropzone
                value={img.url}
                onChange={(url) => onChange({ images: images.map((im, j) => (j === i ? { ...im, url } : im)) })}
              />
              <div className="flex gap-2 items-center mt-2">
                <input
                  value={img.caption ?? ""}
                  onChange={(e) =>
                    onChange({ images: images.map((im, j) => (j === i ? { ...im, caption: e.target.value } : im)) })
                  }
                  placeholder="Caption (optional)"
                  className={inputClass + " flex-1"}
                />
                <button
                  type="button"
                  onClick={() => onChange({ images: images.filter((_, j) => j !== i) })}
                  className="text-xs text-stone hover:text-accent px-2 py-2 shrink-0"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => onChange({ images: [...images, { url: "", caption: "" }] })} className="btn-secondary !px-4 !py-2">
            + Add image
          </button>
        </div>
      );
    }

    case "quote":
      return (
        <div className="space-y-4">
          <Field label="Quote">
            <textarea value={block.text} onChange={(e) => onChange({ text: e.target.value })} rows={3} className={inputClass} />
          </Field>
          <Field label="Attribution (optional)">
            <input value={block.attribution ?? ""} onChange={(e) => onChange({ attribution: e.target.value })} className={inputClass} />
          </Field>
        </div>
      );

    case "button":
      return (
        <div className="space-y-4">
          <Field label="Button label">
            <input value={block.label} onChange={(e) => onChange({ label: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Link (a path like /about, or a full https:// URL)">
            <input value={block.href} onChange={(e) => onChange({ href: e.target.value })} className={inputClass} />
          </Field>
        </div>
      );

    case "spacer":
      return (
        <Field label="Height">
          <select value={block.size} onChange={(e) => onChange({ size: e.target.value })} className={inputClass}>
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>
        </Field>
      );

    case "printGrid":
      return (
        <div className="space-y-4">
          <Field label="Heading (optional)">
            <input value={block.heading ?? ""} onChange={(e) => onChange({ heading: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Which prints">
            <select value={block.mode} onChange={(e) => onChange({ mode: e.target.value })} className={inputClass}>
              <option value="all">All published prints</option>
              <option value="collection">One collection</option>
              <option value="selected">Hand-picked prints</option>
            </select>
          </Field>
          {block.mode === "collection" && (
            <Field label="Collection">
              <select value={block.collectionId ?? ""} onChange={(e) => onChange({ collectionId: e.target.value })} className={inputClass}>
                <option value="">Choose a collection…</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {block.mode === "selected" && (
            <Field label="Prints to show (in the order you check them)">
              <div className="border hairline max-h-64 overflow-y-auto divide-y divide-line">
                {prints.length === 0 && <p className="px-3 py-2 text-sm text-stone">No prints yet.</p>}
                {prints.map((p) => {
                  const current = block.printIds ?? [];
                  const checked = current.includes(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          onChange({
                            printIds: e.target.checked ? [...current, p.id] : current.filter((id) => id !== p.id),
                          })
                        }
                      />
                      {p.title}
                    </label>
                  );
                })}
              </div>
            </Field>
          )}
          {block.mode !== "selected" && (
            <Field label="Limit (optional — leave blank to show all)">
              <input
                type="number"
                min={1}
                value={block.limit ?? ""}
                onChange={(e) => onChange({ limit: e.target.value ? Number(e.target.value) : undefined })}
                className={inputClass + " max-w-[120px]"}
              />
            </Field>
          )}
        </div>
      );

    default:
      return null;
  }
}

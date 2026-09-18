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
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass = "border-line";
const selectClass =
  "flex h-10 w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="label-caps mb-2 block">{label}</Label>
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
      <div className="sticky top-0 z-10 mb-6 flex items-center justify-between border-b border-line bg-paper py-3">
        <p className="label-caps">
          {blocks.length} block{blocks.length === 1 ? "" : "s"}
          {dirty && " · unsaved changes"}
        </p>
        <div className="flex items-center gap-4">
          {error && <p className="text-xs text-accent">{error}</p>}
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : !dirty && justSaved ? "Saved" : "Save changes"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {blocks.map((block, i) => (
          <Card
            key={block.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            className="border-line shadow-none"
          >
            <div
              draggable
              onDragStart={() => setDragIndex(i)}
              className="flex cursor-move select-none items-center justify-between border-b border-line bg-line/40 px-4 py-2"
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
            <CardContent className="p-4">
              <BlockFields block={block} onChange={(patch) => updateBlock(i, patch)} prints={prints} collections={collections} />
            </CardContent>
          </Card>
        ))}

        {blocks.length === 0 && (
          <p className="border border-dashed border-line py-12 text-center text-sm text-stone">
            No content blocks yet — add one below.
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3 border-t border-line pt-6">
        <select value={addType} onChange={(e) => setAddType(e.target.value as BlockType)} className={cn(selectClass, "max-w-[220px]")}>
          {BLOCK_TYPES.map((type) => (
            <option key={type} value={type}>
              {BLOCK_DEFS[type].label}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" onClick={addBlock}>
          + Add block
        </Button>
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
            <Input value={block.eyebrow ?? ""} onChange={(e) => onChange({ eyebrow: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Heading">
            <Input value={block.heading} onChange={(e) => onChange({ heading: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Subheading">
            <Textarea value={block.subheading ?? ""} onChange={(e) => onChange({ subheading: e.target.value })} rows={2} className={inputClass} />
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
            <Input value={block.caption ?? ""} onChange={(e) => onChange({ caption: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Width">
            <select value={block.width ?? "normal"} onChange={(e) => onChange({ width: e.target.value })} className={selectClass}>
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
            <select value={block.imagePosition} onChange={(e) => onChange({ imagePosition: e.target.value })} className={selectClass}>
              <option value="left">Image on left</option>
              <option value="right">Image on right</option>
            </select>
          </Field>
          <Field label="Heading (optional)">
            <Input value={block.heading ?? ""} onChange={(e) => onChange({ heading: e.target.value })} className={inputClass} />
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
            <Card key={i} className="border-line shadow-none">
              <CardContent className="p-3">
                <ImageDropzone
                  value={img.url}
                  onChange={(url) => onChange({ images: images.map((im, j) => (j === i ? { ...im, url } : im)) })}
                />
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    value={img.caption ?? ""}
                    onChange={(e) =>
                      onChange({ images: images.map((im, j) => (j === i ? { ...im, caption: e.target.value } : im)) })
                    }
                    placeholder="Caption (optional)"
                    className={cn(inputClass, "flex-1")}
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ images: images.filter((_, j) => j !== i) })}
                    className="shrink-0 px-2 py-2 text-xs text-stone hover:text-accent"
                  >
                    Remove
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button type="button" variant="secondary" onClick={() => onChange({ images: [...images, { url: "", caption: "" }] })}>
            + Add image
          </Button>
        </div>
      );
    }

    case "quote":
      return (
        <div className="space-y-4">
          <Field label="Quote">
            <Textarea value={block.text} onChange={(e) => onChange({ text: e.target.value })} rows={3} className={inputClass} />
          </Field>
          <Field label="Attribution (optional)">
            <Input value={block.attribution ?? ""} onChange={(e) => onChange({ attribution: e.target.value })} className={inputClass} />
          </Field>
        </div>
      );

    case "button":
      return (
        <div className="space-y-4">
          <Field label="Button label">
            <Input value={block.label} onChange={(e) => onChange({ label: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Link (a path like /about, or a full https:// URL)">
            <Input value={block.href} onChange={(e) => onChange({ href: e.target.value })} className={inputClass} />
          </Field>
        </div>
      );

    case "spacer":
      return (
        <Field label="Height">
          <select value={block.size} onChange={(e) => onChange({ size: e.target.value })} className={selectClass}>
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
            <Input value={block.heading ?? ""} onChange={(e) => onChange({ heading: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Which prints">
            <select value={block.mode} onChange={(e) => onChange({ mode: e.target.value })} className={selectClass}>
              <option value="all">All published prints</option>
              <option value="collection">One collection</option>
              <option value="selected">Hand-picked prints</option>
            </select>
          </Field>
          {block.mode === "collection" && (
            <Field label="Collection">
              <select value={block.collectionId ?? ""} onChange={(e) => onChange({ collectionId: e.target.value })} className={selectClass}>
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
              <Card className="max-h-64 divide-y divide-line overflow-y-auto border-line shadow-none">
                <CardContent className="p-0">
                  {prints.length === 0 && <p className="px-3 py-2 text-sm text-stone">No prints yet.</p>}
                  {prints.map((p) => {
                    const current = block.printIds ?? [];
                    const checked = current.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 border-b border-line px-3 py-2 text-sm last:border-0">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            onChange({
                              printIds: v === true ? [...current, p.id] : current.filter((id) => id !== p.id),
                            })
                          }
                        />
                        {p.title}
                      </label>
                    );
                  })}
                </CardContent>
              </Card>
            </Field>
          )}
          {block.mode !== "selected" && (
            <Field label="Limit (optional — leave blank to show all)">
              <Input
                type="number"
                min={1}
                value={block.limit ?? ""}
                onChange={(e) => onChange({ limit: e.target.value ? Number(e.target.value) : undefined })}
                className={cn(inputClass, "max-w-[120px]")}
              />
            </Field>
          )}
        </div>
      );

    default:
      return null;
  }
}

"use client";

import { useState } from "react";
import {
  CAMPAIGN_BLOCK_DEFS,
  CAMPAIGN_BLOCK_TYPES,
  createCampaignBlock,
  type CampaignBlock,
  type CampaignBlockType,
} from "@/lib/campaignBlocks";
import { ImageDropzone } from "@/components/admin/ImageDropzone";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
 * Block-based editor for a campaign's email content — same add/reorder/
 * duplicate/delete pattern as the storefront page builder (PageBuilder.tsx),
 * but with a smaller, email-specific block set (header, text, images one-
 * or two-across, an action button, social links, spacer, divider) that
 * renders to actual email-safe HTML server-side at save time (see
 * src/lib/campaignRender.ts). Purely controlled — CampaignForm owns the
 * subject/audience fields and the actual save/send/schedule/test buttons,
 * the same way it did around the old single RichTextEditor field this
 * replaces.
 */
export function CampaignBuilder({
  blocks,
  onChange,
}: {
  blocks: CampaignBlock[];
  onChange: (blocks: CampaignBlock[]) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [addType, setAddType] = useState<CampaignBlockType>("text");

  function updateBlock(index: number, patch: Record<string, unknown>) {
    onChange(blocks.map((b, i) => (i === index ? ({ ...b, ...patch } as CampaignBlock) : b)));
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function duplicateBlock(index: number) {
    const source = blocks[index];
    const copy: CampaignBlock = { ...source, id: `${source.id}-copy-${Date.now()}` };
    const next = blocks.slice();
    next.splice(index + 1, 0, copy);
    onChange(next);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;
    const next = blocks.slice();
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    onChange(next);
  }

  function addBlock() {
    onChange([...blocks, createCampaignBlock(addType)]);
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
    onChange(next);
  }

  return (
    <div>
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
              <span className="label-caps">⠿ {CAMPAIGN_BLOCK_DEFS[block.type].label}</span>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => moveBlock(i, -1)}
                  disabled={i === 0}
                  className="text-stone hover:text-ink disabled:opacity-30"
                >
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
              <CampaignBlockFields block={block} onChange={(patch) => updateBlock(i, patch)} />
            </CardContent>
          </Card>
        ))}

        {blocks.length === 0 && (
          <p className="border border-dashed border-line py-12 text-center text-sm text-stone">
            No content yet — add a block below to start building the email.
          </p>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3 border-t border-line pt-6">
        <select
          value={addType}
          onChange={(e) => setAddType(e.target.value as CampaignBlockType)}
          className={cn(selectClass, "max-w-[220px]")}
        >
          {CAMPAIGN_BLOCK_TYPES.map((type) => (
            <option key={type} value={type}>
              {CAMPAIGN_BLOCK_DEFS[type].label}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" onClick={addBlock}>
          + Add block
        </Button>
      </div>
      <p className="mt-3 text-xs text-stone">An unsubscribe link is added automatically — no need to write your own.</p>
    </div>
  );
}

function CampaignBlockFields({
  block,
  onChange,
}: {
  block: CampaignBlock;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  switch (block.type) {
    case "header":
      return (
        <div className="space-y-4">
          <Field label="Eyebrow (small caps line above the heading, optional)">
            <Input value={block.eyebrow ?? ""} onChange={(e) => onChange({ eyebrow: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Heading">
            <Input value={block.heading} onChange={(e) => onChange({ heading: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Subheading (optional)">
            <Input value={block.subheading ?? ""} onChange={(e) => onChange({ subheading: e.target.value })} className={inputClass} />
          </Field>
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
          <Field label="Link when clicked (optional — a full https:// URL)">
            <Input
              value={block.href ?? ""}
              onChange={(e) => onChange({ href: e.target.value })}
              className={inputClass}
              placeholder="https://…"
            />
          </Field>
        </div>
      );

    case "imageTwoUp": {
      const sideFields = (key: "left" | "right", label: string) => (
        <div className="space-y-3 border border-line p-3">
          <p className="label-caps">{label}</p>
          <ImageDropzone value={block[key].imageUrl} onChange={(url) => onChange({ [key]: { ...block[key], imageUrl: url } })} />
          <Input
            value={block[key].caption ?? ""}
            onChange={(e) => onChange({ [key]: { ...block[key], caption: e.target.value } })}
            placeholder="Caption (optional)"
            className={inputClass}
          />
          <Input
            value={block[key].href ?? ""}
            onChange={(e) => onChange({ [key]: { ...block[key], href: e.target.value } })}
            placeholder="Link when clicked (optional)"
            className={inputClass}
          />
        </div>
      );
      return (
        <div className="grid grid-cols-2 gap-4">
          {sideFields("left", "Left image")}
          {sideFields("right", "Right image")}
        </div>
      );
    }

    case "button":
      return (
        <div className="space-y-4">
          <Field label="Button label">
            <Input value={block.label} onChange={(e) => onChange({ label: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Link (a full https:// URL)">
            <Input value={block.href} onChange={(e) => onChange({ href: e.target.value })} className={inputClass} placeholder="https://…" />
          </Field>
        </div>
      );

    case "social":
      return (
        <div className="space-y-4">
          <Field label="Heading above the links (optional)">
            <Input
              value={block.heading ?? ""}
              onChange={(e) => onChange({ heading: e.target.value })}
              className={inputClass}
              placeholder="Follow us"
            />
          </Field>
          <p className="text-xs text-stone">
            Pulls whatever's set in Admin → Settings → Footer → Social links — nothing to configure here.
          </p>
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

    case "divider":
      return <p className="text-xs text-stone">A plain horizontal line — nothing to configure.</p>;

    default:
      return null;
  }
}

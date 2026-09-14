"use client";

import { useState } from "react";
import { updatePrintDetails } from "@/app/admin/(protected)/products/actions";
import { ImageDropzone } from "@/components/admin/ImageDropzone";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { SaveButton } from "@/components/admin/SaveButton";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";

export type ProductEditInitial = {
  id: string;
  title: string;
  artist: string;
  description: string | null;
  technique: string | null;
  paperSize: string | null;
  imageSize: string | null;
  medium: string | null;
  /** Null means an open edition — not limited or numbered. */
  editionSize: number | null;
  year: number | null;
  priceMinor: number;
  currency: string;
  primaryImageUrl: string | null;
  imageUrls: string[];
  weightGrams: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  customsValueMinor: number | null;
  customsDescription: string | null;
  customsCode: string | null;
};

export function ProductEditForm({
  initial,
  mediumOptions,
}: {
  initial: ProductEditInitial;
  mediumOptions: string[];
}) {
  const [primaryImageUrl, setPrimaryImageUrl] = useState(initial.primaryImageUrl ?? "");
  const [imageUrls, setImageUrls] = useState<string[]>(initial.imageUrls);
  const [description, setDescription] = useState(initial.description ?? "");

  // The chosen medium might not (yet) be in the managed list — e.g. it was
  // set before the list existed, or the option was later deleted. Keep it
  // selectable so saving the rest of the form doesn't silently wipe it out.
  const options = initial.medium && !mediumOptions.includes(initial.medium)
    ? [initial.medium, ...mediumOptions]
    : mediumOptions;

  const updateWithId = updatePrintDetails.bind(null, initial.id);

  return (
    <form action={updateWithId} className="space-y-8 max-w-2xl">
      <div>
        <label className="label-caps block mb-2">Primary image</label>
        <ImageDropzone value={primaryImageUrl} onChange={setPrimaryImageUrl} />
        <input type="hidden" name="primaryImageUrl" value={primaryImageUrl} />
      </div>

      <div>
        <label className="label-caps block mb-2">Additional images</label>
        <div className="space-y-3">
          {imageUrls.map((url, i) => (
            <div key={i} className="border hairline p-3">
              <ImageDropzone value={url} onChange={(v) => setImageUrls(imageUrls.map((u, j) => (j === i ? v : u)))} />
              <button
                type="button"
                onClick={() => setImageUrls(imageUrls.filter((_, j) => j !== i))}
                className="text-xs text-stone hover:text-accent mt-2 underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setImageUrls([...imageUrls, ""])}
          className="btn-secondary !px-4 !py-2 mt-3"
        >
          + Add image
        </button>
        <input type="hidden" name="imageUrls" value={JSON.stringify(imageUrls.filter((u) => u.trim()))} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label-caps block mb-2">Title</label>
          <input name="title" defaultValue={initial.title} required className={inputClass} />
        </div>
        <div>
          <label className="label-caps block mb-2">Artist</label>
          <input name="artist" defaultValue={initial.artist} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="label-caps block mb-2">Description</label>
        <RichTextEditor value={description} onChange={setDescription} />
        <input type="hidden" name="description" value={description} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label-caps block mb-2">Price (£)</label>
          <input
            name="price"
            type="number"
            step="0.01"
            min={0}
            required
            defaultValue={(initial.priceMinor / 100).toFixed(2)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="label-caps block mb-2">Year</label>
          <input name="year" type="number" defaultValue={initial.year ?? ""} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="label-caps block mb-2">Edition size</label>
        <input
          name="editionSize"
          defaultValue={initial.editionSize ?? "open"}
          placeholder="e.g. 200, or open"
          className={inputClass + " max-w-[200px]"}
        />
        <p className="text-xs text-stone mt-1">
          A number creates or trims numbered copies to match, 1..N. Type <strong>open</strong> instead for an
          edition that isn't limited or numbered (e.g. a mug or book) — no numbers or remaining-count are ever
          shown for it. Shrinking a number never removes a copy that's already sold, reserved, withheld, or
          damaged.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label-caps block mb-2">Paper size</label>
          <input
            name="paperSize"
            defaultValue={initial.paperSize ?? ""}
            placeholder="e.g. A2 (420 x 594mm)"
            className={inputClass}
          />
        </div>
        <div>
          <label className="label-caps block mb-2">Print size</label>
          <input
            name="imageSize"
            defaultValue={initial.imageSize ?? ""}
            placeholder="e.g. 300 x 400mm"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label-caps block mb-2">Medium</label>
          <select name="medium" defaultValue={initial.medium ?? ""} className={inputClass}>
            <option value="">— None selected —</option>
            {options.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <a href="/admin/settings/mediums" className="text-xs text-stone hover:text-ink underline mt-1 inline-block">
            Add another medium option
          </a>
        </div>
        <div>
          <label className="label-caps block mb-2">Technique</label>
          <input
            name="technique"
            defaultValue={initial.technique ?? ""}
            placeholder="e.g. Screenprint, 6 colours"
            className={inputClass}
          />
        </div>
      </div>

      <div className="border-t hairline pt-6">
        <h2 className="label-caps mb-1">Shipping & customs</h2>
        <p className="text-xs text-stone mb-4">
          For ONE packaged copy of this print. Weight and size feed the live UPS cost shown on the Packing tab.
          The customs fields are used to build the commercial invoice needed for shipments outside the UK
          (Europe and rest-of-world) — until these are filled in, that paperwork will use generic placeholders.
        </p>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div>
            <label className="label-caps block mb-2">Weight (g)</label>
            <input
              name="weightGrams"
              type="number"
              min={0}
              defaultValue={initial.weightGrams ?? ""}
              placeholder="e.g. 450"
              className={inputClass}
            />
          </div>
          <div>
            <label className="label-caps block mb-2">Length (cm)</label>
            <input
              name="lengthCm"
              type="number"
              step="0.1"
              min={0}
              defaultValue={initial.lengthCm ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className="label-caps block mb-2">Width (cm)</label>
            <input
              name="widthCm"
              type="number"
              step="0.1"
              min={0}
              defaultValue={initial.widthCm ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className="label-caps block mb-2">Height (cm)</label>
            <input
              name="heightCm"
              type="number"
              step="0.1"
              min={0}
              defaultValue={initial.heightCm ?? ""}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label-caps block mb-2">Customs value (£ per unit)</label>
            <input
              name="customsValue"
              type="number"
              step="0.01"
              min={0}
              defaultValue={initial.customsValueMinor != null ? (initial.customsValueMinor / 100).toFixed(2) : ""}
              placeholder={`Defaults to the price, ${(initial.priceMinor / 100).toFixed(2)}`}
              className={inputClass}
            />
          </div>
          <div>
            <label className="label-caps block mb-2">Customs (HS) code</label>
            <input
              name="customsCode"
              defaultValue={initial.customsCode ?? ""}
              placeholder="e.g. 9701.10"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="label-caps block mb-2">Customs description</label>
          <input
            name="customsDescription"
            defaultValue={initial.customsDescription ?? ""}
            placeholder="e.g. Framed art print — leave blank to use the title"
            className={inputClass}
          />
        </div>
      </div>

      <SaveButton>Save product</SaveButton>
    </form>
  );
}

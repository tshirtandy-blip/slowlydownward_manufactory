"use client";

import { useState } from "react";
import { updatePrintDetails } from "@/app/admin/(protected)/products/actions";
import { ImageDropzone } from "@/components/admin/ImageDropzone";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { SaveButton } from "@/components/admin/SaveButton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const selectClass =
  "flex h-10 w-full border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

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
    <form action={updateWithId} className="max-w-2xl space-y-8">
      <div>
        <Label className="label-caps mb-2 block">Primary image</Label>
        <ImageDropzone value={primaryImageUrl} onChange={setPrimaryImageUrl} />
        <input type="hidden" name="primaryImageUrl" value={primaryImageUrl} />
      </div>

      <div>
        <Label className="label-caps mb-2 block">Additional images</Label>
        <div className="space-y-3">
          {imageUrls.map((url, i) => (
            <Card key={i} className="border-line shadow-none">
              <CardContent className="p-3">
                <ImageDropzone value={url} onChange={(v) => setImageUrls(imageUrls.map((u, j) => (j === i ? v : u)))} />
                <button
                  type="button"
                  onClick={() => setImageUrls(imageUrls.filter((_, j) => j !== i))}
                  className="mt-2 text-xs text-stone underline hover:text-accent"
                >
                  Remove
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button type="button" variant="secondary" className="mt-3" onClick={() => setImageUrls([...imageUrls, ""])}>
          + Add image
        </Button>
        <input type="hidden" name="imageUrls" value={JSON.stringify(imageUrls.filter((u) => u.trim()))} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="peTitle" className="label-caps mb-2 block">
            Title
          </Label>
          <Input id="peTitle" name="title" defaultValue={initial.title} required className="border-line" />
        </div>
        <div>
          <Label htmlFor="peArtist" className="label-caps mb-2 block">
            Artist
          </Label>
          <Input id="peArtist" name="artist" defaultValue={initial.artist} className="border-line" />
        </div>
      </div>

      <div>
        <Label className="label-caps mb-2 block">Description</Label>
        <RichTextEditor value={description} onChange={setDescription} />
        <input type="hidden" name="description" value={description} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="pePrice" className="label-caps mb-2 block">
            Price (£)
          </Label>
          <Input
            id="pePrice"
            name="price"
            type="number"
            step="0.01"
            min={0}
            required
            defaultValue={(initial.priceMinor / 100).toFixed(2)}
            className="border-line"
          />
        </div>
        <div>
          <Label htmlFor="peYear" className="label-caps mb-2 block">
            Year
          </Label>
          <Input id="peYear" name="year" type="number" defaultValue={initial.year ?? ""} className="border-line" />
        </div>
      </div>

      <div>
        <Label htmlFor="peEditionSize" className="label-caps mb-2 block">
          Edition size
        </Label>
        <Input
          id="peEditionSize"
          name="editionSize"
          defaultValue={initial.editionSize ?? "open"}
          placeholder="e.g. 200, or open"
          className="max-w-[200px] border-line"
        />
        <p className="mt-1 text-xs text-stone">
          A number creates or trims numbered copies to match, 1..N. Type <strong>open</strong> instead for an
          edition that isn't limited or numbered (e.g. a mug or book) — no numbers or remaining-count are ever
          shown for it. Shrinking a number never removes a copy that's already sold, reserved, withheld, or
          damaged.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="pePaperSize" className="label-caps mb-2 block">
            Paper size
          </Label>
          <Input
            id="pePaperSize"
            name="paperSize"
            defaultValue={initial.paperSize ?? ""}
            placeholder="e.g. A2 (420 x 594mm)"
            className="border-line"
          />
        </div>
        <div>
          <Label htmlFor="peImageSize" className="label-caps mb-2 block">
            Print size
          </Label>
          <Input
            id="peImageSize"
            name="imageSize"
            defaultValue={initial.imageSize ?? ""}
            placeholder="e.g. 300 x 400mm"
            className="border-line"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="peMedium" className="label-caps mb-2 block">
            Medium
          </Label>
          <select id="peMedium" name="medium" defaultValue={initial.medium ?? ""} className={selectClass}>
            <option value="">— None selected —</option>
            {options.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <a href="/admin/settings/mediums" className="mt-1 inline-block text-xs text-stone underline hover:text-ink">
            Add another medium option
          </a>
        </div>
        <div>
          <Label htmlFor="peTechnique" className="label-caps mb-2 block">
            Technique
          </Label>
          <Input
            id="peTechnique"
            name="technique"
            defaultValue={initial.technique ?? ""}
            placeholder="e.g. Screenprint, 6 colours"
            className="border-line"
          />
        </div>
      </div>

      <div className="border-t border-line pt-6">
        <h2 className="label-caps mb-1">Shipping &amp; customs</h2>
        <p className="mb-4 text-xs text-stone">
          For ONE packaged copy of this print. Weight and size feed the live UPS cost shown on the Packing tab.
          The customs fields are used to build the commercial invoice needed for shipments outside the UK
          (Europe and rest-of-world) — until these are filled in, that paperwork will use generic placeholders.
        </p>

        <div className="mb-4 grid grid-cols-4 gap-4">
          <div>
            <Label htmlFor="peWeight" className="label-caps mb-2 block">
              Weight (g)
            </Label>
            <Input
              id="peWeight"
              name="weightGrams"
              type="number"
              min={0}
              defaultValue={initial.weightGrams ?? ""}
              placeholder="e.g. 450"
              className="border-line"
            />
          </div>
          <div>
            <Label htmlFor="peLength" className="label-caps mb-2 block">
              Length (cm)
            </Label>
            <Input
              id="peLength"
              name="lengthCm"
              type="number"
              step="0.1"
              min={0}
              defaultValue={initial.lengthCm ?? ""}
              className="border-line"
            />
          </div>
          <div>
            <Label htmlFor="peWidth" className="label-caps mb-2 block">
              Width (cm)
            </Label>
            <Input
              id="peWidth"
              name="widthCm"
              type="number"
              step="0.1"
              min={0}
              defaultValue={initial.widthCm ?? ""}
              className="border-line"
            />
          </div>
          <div>
            <Label htmlFor="peHeight" className="label-caps mb-2 block">
              Height (cm)
            </Label>
            <Input
              id="peHeight"
              name="heightCm"
              type="number"
              step="0.1"
              min={0}
              defaultValue={initial.heightCm ?? ""}
              className="border-line"
            />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="peCustomsValue" className="label-caps mb-2 block">
              Customs value (£ per unit)
            </Label>
            <Input
              id="peCustomsValue"
              name="customsValue"
              type="number"
              step="0.01"
              min={0}
              defaultValue={initial.customsValueMinor != null ? (initial.customsValueMinor / 100).toFixed(2) : ""}
              placeholder={`Defaults to the price, ${(initial.priceMinor / 100).toFixed(2)}`}
              className="border-line"
            />
          </div>
          <div>
            <Label htmlFor="peCustomsCode" className="label-caps mb-2 block">
              Customs (HS) code
            </Label>
            <Input
              id="peCustomsCode"
              name="customsCode"
              defaultValue={initial.customsCode ?? ""}
              placeholder="e.g. 9701.10"
              className="border-line"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="peCustomsDescription" className="label-caps mb-2 block">
            Customs description
          </Label>
          <Input
            id="peCustomsDescription"
            name="customsDescription"
            defaultValue={initial.customsDescription ?? ""}
            placeholder="e.g. Framed art print — leave blank to use the title"
            className="border-line"
          />
        </div>
      </div>

      <SaveButton>Save product</SaveButton>
    </form>
  );
}

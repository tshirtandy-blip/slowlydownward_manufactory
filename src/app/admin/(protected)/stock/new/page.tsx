import { createPrint } from "../actions";

export default function NewPrintPage() {
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl mb-8">Add a new print</h1>
      <form action={createPrint} className="space-y-5">
        <div>
          <label className="label-caps block mb-2">Title</label>
          <input name="title" required className="border hairline bg-transparent px-3 py-2 text-sm w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-caps block mb-2">Edition size</label>
            <input
              name="editionSize"
              type="number"
              min={1}
              required
              className="border hairline bg-transparent px-3 py-2 text-sm w-full"
            />
            <p className="text-xs text-stone mt-1">Creates one numbered edition row per copy, 1..N.</p>
          </div>
          <div>
            <label className="label-caps block mb-2">Price (£)</label>
            <input
              name="price"
              type="number"
              step="0.01"
              min={0}
              required
              className="border hairline bg-transparent px-3 py-2 text-sm w-full"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-caps block mb-2">Technique</label>
            <input name="technique" className="border hairline bg-transparent px-3 py-2 text-sm w-full" />
          </div>
          <div>
            <label className="label-caps block mb-2">Dimensions</label>
            <input name="dimensions" className="border hairline bg-transparent px-3 py-2 text-sm w-full" />
          </div>
        </div>
        <div>
          <label className="label-caps block mb-2">Year</label>
          <input name="year" type="number" className="border hairline bg-transparent px-3 py-2 text-sm w-full max-w-[120px]" />
        </div>
        <div>
          <label className="label-caps block mb-2">Image URL</label>
          <input name="imageUrl" placeholder="https://…" className="border hairline bg-transparent px-3 py-2 text-sm w-full" />
        </div>
        <div>
          <label className="label-caps block mb-2">Description</label>
          <textarea name="description" rows={4} className="border hairline bg-transparent px-3 py-2 text-sm w-full" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="published" />
          Publish immediately (visible on the storefront)
        </label>

        <button type="submit" className="btn-primary">
          Create print &amp; generate editions
        </button>
      </form>
    </div>
  );
}

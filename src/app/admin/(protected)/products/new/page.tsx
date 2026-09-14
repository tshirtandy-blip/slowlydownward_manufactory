import { createPrint } from "../actions";

export default function NewPrintPage() {
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl mb-8">Add a new product</h1>
      <p className="text-sm text-stone mb-6 -mt-4">
        Just the essentials to get started — paper size, image size, medium, extra photos, and the drawer
        location are all added afterwards from the product's own page.
      </p>
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
              required
              placeholder="e.g. 200, or open"
              className="border hairline bg-transparent px-3 py-2 text-sm w-full"
            />
            <p className="text-xs text-stone mt-1">
              A number creates one numbered copy per edition, 1..N. Type <strong>open</strong> instead for an
              edition that isn't limited or numbered (e.g. a mug or book) — no numbers or remaining-count are
              ever shown for it.
            </p>
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
            <label className="label-caps block mb-2">Year</label>
            <input name="year" type="number" className="border hairline bg-transparent px-3 py-2 text-sm w-full" />
          </div>
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
          Create product &amp; generate editions
        </button>
      </form>
    </div>
  );
}

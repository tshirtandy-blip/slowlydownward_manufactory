import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addMediumOption, deleteMediumOption } from "./actions";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

export const dynamic = "force-dynamic";

export default async function MediumsSettingsPage() {
  const mediums = await prisma.mediumOption.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="max-w-md">
      <Link href="/admin/settings" className="label-caps text-stone hover:text-ink">
        ← Settings
      </Link>
      <h1 className="font-display text-2xl mt-2 mb-2">Product mediums</h1>
      <p className="text-sm text-stone mb-8">
        The options offered in the "Medium" dropdown when editing a product — e.g. Screenprint, Giclée, Mug,
        Book. Add as many as you need.
      </p>

      <div className="border hairline mb-8">
        {mediums.map((medium) => (
          <div key={medium.id} className="flex items-center justify-between px-3 py-2 border-b hairline last:border-0">
            <span className="text-sm">{medium.name}</span>
            <form action={deleteMediumOption.bind(null, medium.id)}>
              <ConfirmSubmitButton
                confirmText={`Remove "${medium.name}" from the medium dropdown? Products already using it keep it, but new ones won't be able to pick it.`}
                className="text-xs text-stone hover:text-accent"
              >
                Remove
              </ConfirmSubmitButton>
            </form>
          </div>
        ))}
        {mediums.length === 0 && <p className="px-3 py-6 text-sm text-stone text-center">No mediums added yet.</p>}
      </div>

      <form action={addMediumOption} className="flex gap-2">
        <input
          name="name"
          required
          placeholder="e.g. Giclée"
          className="border hairline bg-transparent px-3 py-2 text-sm flex-1"
        />
        <button className="btn-primary !px-4 !py-2">Add</button>
      </form>
    </div>
  );
}

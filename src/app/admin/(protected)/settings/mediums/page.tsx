import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addMediumOption, deleteMediumOption } from "./actions";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

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

      <Card className="mb-8 border-line shadow-none">
        <CardContent className="p-0">
          {mediums.map((medium) => (
            <div key={medium.id} className="flex items-center justify-between border-b border-line px-3 py-2 last:border-0">
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
          {mediums.length === 0 && <p className="px-3 py-6 text-center text-sm text-stone">No mediums added yet.</p>}
        </CardContent>
      </Card>

      <form action={addMediumOption} className="flex gap-2">
        <Input name="name" required placeholder="e.g. Giclée" className="border-line" />
        <Button type="submit">Add</Button>
      </form>
    </div>
  );
}

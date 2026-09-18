import { createPrint } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export default function NewPrintPage() {
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-2xl mb-8">Add a new product</h1>
      <p className="-mt-4 mb-6 text-sm text-stone">
        Just the essentials to get started — paper size, image size, medium, extra photos, and the drawer
        location are all added afterwards from the product's own page.
      </p>
      <form action={createPrint} className="space-y-5">
        <Card className="border-line shadow-none">
          <CardContent className="space-y-5 p-6">
            <div>
              <Label htmlFor="npTitle" className="label-caps mb-2 block">
                Title
              </Label>
              <Input id="npTitle" name="title" required className="border-line" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="npEditionSize" className="label-caps mb-2 block">
                  Edition size
                </Label>
                <Input id="npEditionSize" name="editionSize" required placeholder="e.g. 200, or open" className="border-line" />
                <p className="mt-1 text-xs text-stone">
                  A number creates one numbered copy per edition, 1..N. Type <strong>open</strong> instead for an
                  edition that isn't limited or numbered (e.g. a mug or book) — no numbers or remaining-count are
                  ever shown for it.
                </p>
              </div>
              <div>
                <Label htmlFor="npPrice" className="label-caps mb-2 block">
                  Price (£)
                </Label>
                <Input id="npPrice" name="price" type="number" step="0.01" min={0} required className="border-line" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="npTechnique" className="label-caps mb-2 block">
                  Technique
                </Label>
                <Input id="npTechnique" name="technique" className="border-line" />
              </div>
              <div>
                <Label htmlFor="npYear" className="label-caps mb-2 block">
                  Year
                </Label>
                <Input id="npYear" name="year" type="number" className="border-line" />
              </div>
            </div>
            <div>
              <Label htmlFor="npImageUrl" className="label-caps mb-2 block">
                Image URL
              </Label>
              <Input id="npImageUrl" name="imageUrl" placeholder="https://…" className="border-line" />
            </div>
            <div>
              <Label htmlFor="npDescription" className="label-caps mb-2 block">
                Description
              </Label>
              <Textarea id="npDescription" name="description" rows={4} className="border-line" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="npPublished" name="published" />
              <Label htmlFor="npPublished" className="text-sm font-normal">
                Publish immediately (visible on the storefront)
              </Label>
            </div>
          </CardContent>
        </Card>

        <Button type="submit">Create product &amp; generate editions</Button>
      </form>
    </div>
  );
}

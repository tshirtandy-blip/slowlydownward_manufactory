"use client";

import { updateEditionSettings } from "./actions";
import { SaveButton } from "@/components/admin/SaveButton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function EditionSettingsForm({ minutes, note }: { minutes: number; note: string }) {
  return (
    <form action={updateEditionSettings} className="max-w-xl space-y-6">
      <Card className="border-line shadow-none">
        <CardContent className="space-y-6 p-6">
          <div>
            <Label htmlFor="editionReservationMinutes" className="label-caps mb-2 block">
              Reservation time (minutes)
            </Label>
            <Input
              id="editionReservationMinutes"
              name="editionReservationMinutes"
              type="number"
              min={1}
              max={60}
              defaultValue={minutes}
              className="max-w-[120px] border-line"
            />
            <p className="mt-2 max-w-md text-xs text-stone">
              How long a customer's chosen edition number is held just for them once it's in their cart, before
              it's released back to everyone else if they haven't finished checking out.
            </p>
          </div>

          <div>
            <Label htmlFor="editionPickerNote" className="label-caps mb-2 block">
              Text shown by the edition number picker
            </Label>
            <Textarea
              id="editionPickerNote"
              name="editionPickerNote"
              defaultValue={note}
              rows={3}
              className="border-line"
            />
            <p className="mt-2 max-w-md text-xs text-stone">
              Shown to customers next to the edition number dropdown on a print's page. It won't automatically
              update if you change the number of minutes above — edit the wording here to match if you want it
              to mention a specific time.
            </p>
          </div>
        </CardContent>
      </Card>

      <SaveButton>Save</SaveButton>
    </form>
  );
}

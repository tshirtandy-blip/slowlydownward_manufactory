"use client";

import { updateEditionSettings } from "./actions";
import { SaveButton } from "@/components/admin/SaveButton";

const inputClass = "border hairline bg-transparent px-3 py-2 text-sm w-full";

export function EditionSettingsForm({ minutes, note }: { minutes: number; note: string }) {
  return (
    <form action={updateEditionSettings} className="space-y-8 max-w-xl">
      <div>
        <label className="label-caps block mb-2">Reservation time (minutes)</label>
        <input
          name="editionReservationMinutes"
          type="number"
          min={1}
          max={60}
          defaultValue={minutes}
          className={inputClass + " max-w-[120px]"}
        />
        <p className="text-xs text-stone mt-2 max-w-md">
          How long a customer's chosen edition number is held just for them once it's in their cart, before it's
          released back to everyone else if they haven't finished checking out.
        </p>
      </div>

      <div>
        <label className="label-caps block mb-2">Text shown by the edition number picker</label>
        <textarea name="editionPickerNote" defaultValue={note} rows={3} className={inputClass + " min-h-[5rem]"} />
        <p className="text-xs text-stone mt-2 max-w-md">
          Shown to customers next to the edition number dropdown on a print's page. It won't automatically
          update if you change the number of minutes above — edit the wording here to match if you want it to
          mention a specific time.
        </p>
      </div>

      <SaveButton>Save</SaveButton>
    </form>
  );
}

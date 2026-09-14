"use client";

import { useState, useTransition } from "react";
import { updateDrawerLocation } from "@/app/admin/(protected)/products/actions";

/** A single drawer/location for the whole print — every copy of an edition
 * is stored together, so this replaces editing a location per edition row. */
export function DrawerLocationEditor({ printId, initial }: { printId: string; initial: string }) {
  const [code, setCode] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <input
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setSaved(false);
        }}
        placeholder="e.g. C3-D5"
        className="border hairline bg-transparent px-3 py-2 text-sm w-40"
      />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await updateDrawerLocation(printId, code);
            setSaved(true);
          })
        }
        className="text-xs underline text-stone hover:text-ink disabled:opacity-40"
      >
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}

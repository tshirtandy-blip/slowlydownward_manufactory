"use client";

import { useState, useTransition } from "react";
import { updateDrawerLocation } from "@/app/admin/(protected)/products/actions";
import { Input } from "@/components/ui/input";

/** A single drawer/location for the whole print — every copy of an edition
 * is stored together, so this replaces editing a location per edition row. */
export function DrawerLocationEditor({ printId, initial }: { printId: string; initial: string }) {
  const [code, setCode] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Input
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setSaved(false);
        }}
        placeholder="e.g. C3-D5"
        className="w-40 border-line"
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
        className="text-xs text-stone underline hover:text-ink disabled:opacity-40"
      >
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}

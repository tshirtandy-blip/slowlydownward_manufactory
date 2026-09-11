"use client";

import { useState, useTransition } from "react";
import { updateEditionLocation, updateEditionStatus } from "@/app/admin/(protected)/stock/actions";

const STATUS_OPTIONS = ["AVAILABLE", "WITHHELD", "DAMAGED"] as const;

export function EditionRow({
  id,
  number,
  status,
  locationCode,
  soldTo,
}: {
  id: string;
  number: number;
  status: string;
  locationCode?: string;
  soldTo?: string;
}) {
  const [code, setCode] = useState(locationCode ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const locked = status === "SOLD" || status === "RESERVED";

  return (
    <tr className="border-b hairline last:border-0">
      <td className="py-2 pr-4 font-medium">#{number}</td>
      <td className="py-2 pr-4">
        {locked ? (
          <span className="text-stone">{status === "SOLD" ? `Sold${soldTo ? ` — ${soldTo}` : ""}` : status}</span>
        ) : (
          <select
            defaultValue={status}
            onChange={(e) =>
              startTransition(() => updateEditionStatus(id, e.target.value as any))
            }
            className="border hairline bg-transparent px-2 py-1 text-xs"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="py-2 pr-4">
        <div className="flex items-center gap-2">
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. C3-D5"
            className="border hairline bg-transparent px-2 py-1 text-xs w-28"
          />
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await updateEditionLocation(id, code);
                setSaved(true);
              })
            }
            className="text-xs underline text-stone hover:text-ink disabled:opacity-40"
          >
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </td>
    </tr>
  );
}

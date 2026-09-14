"use client";

import { useTransition } from "react";
import { updateEditionStatus } from "@/app/admin/(protected)/products/actions";

const STATUS_OPTIONS = ["AVAILABLE", "WITHHELD", "DAMAGED"] as const;

export function EditionRow({
  id,
  number,
  status,
  soldTo,
}: {
  id: string;
  number: number;
  status: string;
  /** The buying customer's name (or email, if no name was captured) —
   * shown so staff can see at a glance whose collection each copy is part
   * of. Only ever set when status is SOLD. */
  soldTo?: string;
}) {
  const [pending, startTransition] = useTransition();

  const locked = status === "SOLD" || status === "RESERVED";

  return (
    <tr className="border-b hairline last:border-0">
      <td className="py-2 pr-4 font-medium">#{number}</td>
      <td className="py-2 pr-4">
        {locked ? (
          <span className="text-stone">{status === "SOLD" ? "Sold" : status}</span>
        ) : (
          <select
            defaultValue={status}
            disabled={pending}
            onChange={(e) => startTransition(() => updateEditionStatus(id, e.target.value as any))}
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
      <td className="py-2 pr-4">{status === "SOLD" ? soldTo ?? "—" : ""}</td>
    </tr>
  );
}

"use client";

import { useState, useTransition } from "react";
import { updateCourierStatus, refreshCourierStatus } from "@/app/admin/(protected)/orders/[id]/actions";

const PRESETS = ["Label created", "Collected", "In transit", "Delivered"];

export function CourierStatusEditor({
  orderId,
  initialStatus,
  hasTrackingNumber,
}: {
  orderId: string;
  initialStatus: string | null;
  hasTrackingNumber: boolean;
}) {
  const [status, setStatus] = useState(initialStatus ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRefresh() {
    setError(null);
    startTransition(async () => {
      const result = await refreshCourierStatus(orderId);
      if (result.ok) {
        setStatus(result.status);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <form
        action={(formData) => {
          setError(null);
          startTransition(() => updateCourierStatus(orderId, formData));
        }}
        className="flex items-center gap-2"
      >
        <input
          name="courierStatus"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          list="courier-status-presets"
          placeholder="Not yet set"
          className="border hairline bg-transparent px-2 py-1 text-sm w-40"
        />
        <datalist id="courier-status-presets">
          {PRESETS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <button type="submit" disabled={pending} className="text-xs underline text-stone hover:text-ink disabled:opacity-50">
          Save
        </button>
        {hasTrackingNumber && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={pending}
            className="text-xs underline text-stone hover:text-ink disabled:opacity-50"
          >
            {pending ? "Checking…" : "Refresh from carrier"}
          </button>
        )}
      </form>
      {error && <p className="text-xs text-accent mt-1">{error}</p>}
    </div>
  );
}

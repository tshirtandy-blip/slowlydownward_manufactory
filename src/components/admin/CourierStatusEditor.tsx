"use client";

import { useState, useTransition } from "react";
import { updateCourierStatus, refreshCourierStatus } from "@/app/admin/(protected)/orders/[id]/actions";
import { Input } from "@/components/ui/input";

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
        <Input
          name="courierStatus"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          list="courier-status-presets"
          placeholder="Not yet set"
          className="h-8 w-40 border-line py-1"
        />
        <datalist id="courier-status-presets">
          {PRESETS.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <button type="submit" disabled={pending} className="text-xs text-stone underline hover:text-ink disabled:opacity-50">
          Save
        </button>
        {hasTrackingNumber && (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={pending}
            className="text-xs text-stone underline hover:text-ink disabled:opacity-50"
          >
            {pending ? "Checking…" : "Refresh from carrier"}
          </button>
        )}
      </form>
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
    </div>
  );
}

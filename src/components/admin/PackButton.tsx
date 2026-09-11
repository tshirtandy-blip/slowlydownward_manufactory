"use client";

import { useState, useTransition } from "react";

export function PackButton({ orderId, action }: { orderId: string; action: (id: string) => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) return <span className="label-caps text-stone">Packed</span>;

  return (
    <button
      disabled={pending}
      onClick={() => startTransition(async () => {
        await action(orderId);
        setDone(true);
      })}
      className="btn-secondary !px-4 !py-2 disabled:opacity-50"
    >
      {pending ? "Packing…" : "Mark packed & create label"}
    </button>
  );
}

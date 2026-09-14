"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regeneratePaymentLink, resendPaymentLinkEmail, cancelOrder } from "@/app/admin/(protected)/orders/[id]/actions";

/** The payment-link box on a manual order's page — generate/regenerate the
 * Stripe link, (re)send the client's email, copy the link to paste
 * somewhere yourself, and cancel the order (releasing whatever edition(s)
 * it's holding) while it's still awaiting payment. */
export function ManualOrderPanel({
  orderId,
  initialPaymentLinkUrl,
  initialPaymentLinkSentAt,
  customerEmail,
  canCancel,
}: {
  orderId: string;
  initialPaymentLinkUrl: string | null;
  initialPaymentLinkSentAt: string | null;
  customerEmail: string;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState(initialPaymentLinkUrl);
  const [sentAt, setSentAt] = useState(initialPaymentLinkSentAt);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleRegenerate() {
    setError(null);
    startTransition(async () => {
      const result = await regeneratePaymentLink(orderId);
      if (result.ok) setLink(result.url);
      else setError(result.error);
    });
  }

  function handleResend() {
    setError(null);
    startTransition(async () => {
      const result = await resendPaymentLinkEmail(orderId);
      if (result.ok) setSentAt(new Date().toISOString());
      else setError(result.error);
    });
  }

  function handleCopy() {
    if (!link) return;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  function handleCancel() {
    if (!window.confirm("Cancel this order and release the held edition(s) back to available?")) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelOrder(orderId);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="border hairline p-5 mb-8">
      <h2 className="label-caps mb-3">Payment link</h2>
      {link ? (
        <div className="flex items-center gap-3 flex-wrap">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="border hairline bg-transparent px-3 py-2 text-xs flex-1 min-w-[240px]"
          />
          <button type="button" onClick={handleCopy} className="btn-secondary !px-3 !py-1.5 text-xs">
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-stone">No payment link yet.</p>
      )}
      <p className="text-xs text-stone mt-2">
        {sentAt
          ? `Emailed to ${customerEmail} on ${new Date(sentAt).toLocaleString("en-GB")}.`
          : `Not emailed to ${customerEmail} yet.`}
      </p>
      <div className="flex items-center gap-4 mt-4 flex-wrap">
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={pending}
          className="text-xs underline text-stone hover:text-ink disabled:opacity-50"
        >
          {pending ? "Working…" : link ? "Generate new link" : "Generate link"}
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={pending || !link}
          className="text-xs underline text-stone hover:text-ink disabled:opacity-50"
        >
          {sentAt ? "Resend email" : "Send email"}
        </button>
        {canCancel && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="text-xs underline text-accent hover:opacity-70 disabled:opacity-50"
          >
            Cancel this order
          </button>
        )}
      </div>
      {error && <p className="text-sm text-accent mt-3">{error}</p>}
    </div>
  );
}

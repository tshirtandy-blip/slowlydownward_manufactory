"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regeneratePaymentLink, resendPaymentLinkEmail, cancelOrder } from "@/app/admin/(protected)/orders/[id]/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <Card className="mb-8 border-line shadow-none">
      <CardContent className="p-5">
        <h2 className="label-caps mb-3">Payment link</h2>
        {link ? (
          <div className="flex flex-wrap items-center gap-3">
            <Input
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="min-w-[240px] flex-1 border-line text-xs"
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-stone">No payment link yet.</p>
        )}
        <p className="mt-2 text-xs text-stone">
          {sentAt
            ? `Emailed to ${customerEmail} on ${new Date(sentAt).toLocaleString("en-GB")}.`
            : `Not emailed to ${customerEmail} yet.`}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={pending}
            className="text-xs text-stone underline hover:text-ink disabled:opacity-50"
          >
            {pending ? "Working…" : link ? "Generate new link" : "Generate link"}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={pending || !link}
            className="text-xs text-stone underline hover:text-ink disabled:opacity-50"
          >
            {sentAt ? "Resend email" : "Send email"}
          </button>
          {canCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={pending}
              className="text-xs text-accent underline hover:opacity-70 disabled:opacity-50"
            >
              Cancel this order
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      </CardContent>
    </Card>
  );
}

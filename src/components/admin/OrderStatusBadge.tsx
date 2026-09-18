import { Badge } from "@/components/ui/badge";

// Shared status -> colour mapping, previously duplicated across the
// orders list, order detail, and customer detail pages.
const STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING_PAYMENT: "text-stone border-line",
  PAID: "text-accent border-accent",
  PACKING: "text-accent border-accent",
  PACKED: "text-ink border-ink",
  SHIPPED: "text-ink border-ink",
  CANCELLED: "text-stone border-line line-through",
  REFUNDED: "text-stone border-line line-through",
};

export function OrderStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="outline" className={[STATUS_BADGE_CLASS[status] ?? "", className].filter(Boolean).join(" ")}>
      {status.replace("_", " ")}
    </Badge>
  );
}

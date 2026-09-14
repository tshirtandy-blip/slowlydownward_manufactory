/** Formats milliseconds remaining as "M:SS" (e.g. "4:37"), floored at zero —
 * shared between the print page's picker (AddToCartForm.tsx) and the cart
 * page (CartPageClient.tsx) so a reservation's countdown looks and behaves
 * identically wherever it's shown. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** Once a hold has a minute or less left, the countdown turns urgent (red) —
 * used identically everywhere a reservation countdown is shown. */
export function isCountdownUrgent(ms: number): boolean {
  return ms > 0 && ms <= 60_000;
}

"use client";

const KEY = "slowlydownward_visitor_id";

/** A random anonymous id for this browser, created once and reused —
 * no cookies, no personal data, just enough to count "how many distinct
 * people" for the dashboard's live visitor widgets. Safe to call
 * repeatedly; always returns the same id once one exists. */
export function getOrCreateVisitorId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Storage unavailable (private browsing, etc.) — fall back to a
    // per-page-load id. It just won't be counted as the "same" visitor
    // across page loads, which is fine for a rough live count.
    return crypto.randomUUID();
  }
}

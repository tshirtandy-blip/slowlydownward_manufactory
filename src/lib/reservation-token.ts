const STORAGE_KEY = "slowlydownward_reservation_token";

/**
 * Identifies this browser to the edition-reservation endpoints — nothing to
 * do with an account or the cart itself, just enough for the server to tell
 * "the same visitor picked this number" apart from everyone else, so a
 * reservation can later be renewed, confirmed at checkout, or released by
 * whoever holds it and no one else.
 */
export function getReservationToken(): string {
  if (typeof window === "undefined") return "";
  try {
    let token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, token);
    }
    return token;
  } catch {
    // Storage unavailable (private browsing, blocked site data, etc.) —
    // reservations still work for this page view, they just won't be
    // recognised as "yours" any more after a refresh.
    return crypto.randomUUID();
  }
}

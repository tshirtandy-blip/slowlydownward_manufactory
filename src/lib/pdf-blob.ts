/** Turns a base64-encoded PDF (as returned by server actions like
 * generateCoaPdf and previewCoaPdf) into a Blob the browser can open. Pure
 * browser API usage — safe to import from a client component. */
export function base64ToPdfBlob(base64: string): Blob {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
}

/** Opens a base64 PDF in a tab that was ALREADY opened synchronously (in
 * direct response to a click, via `window.open("", "_blank")`) — browsers
 * block window.open() called after an `await`, since by then it no longer
 * looks like a direct user gesture, so the caller must open the blank tab
 * before starting any async work and pass it in here once the PDF is
 * ready. Falls back to a fresh window.open() if the popup was blocked or
 * closed anyway. */
export function openPdfInTab(popup: Window | null, base64: string) {
  const url = URL.createObjectURL(base64ToPdfBlob(base64));
  if (popup && !popup.closed) {
    popup.location.href = url;
  } else {
    window.open(url, "_blank");
  }
}

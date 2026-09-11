"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary !px-4 !py-2">
      Print
    </button>
  );
}

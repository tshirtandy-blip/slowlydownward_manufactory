"use client";

/**
 * Shared label display used both right after packing (PackCarrierPicker)
 * and for reprinting later from the order detail page. UPS labels come
 * back as a GIF embedded in a data: URL (see src/lib/integrations/ups.ts)
 * so they render as a plain image and print through any printer's normal
 * driver — a Royal Mail label is instead a plain hosted URL, so that case
 * just links out to it rather than trying to embed/print it here.
 */
export function ShippingLabelPreview({
  labelUrl,
  trackingNumber,
  carrier,
}: {
  labelUrl?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
}) {
  if (!labelUrl && !trackingNumber) return null;

  const isImage = !!labelUrl?.startsWith("data:image");
  const carrierLabel = carrier === "ROYAL_MAIL" ? "Royal Mail" : carrier === "UPS" ? "UPS" : carrier;

  function handlePrint() {
    // A new window sized to exactly 4x6" (the thermal label stock) with the
    // label image as its only content, printed as soon as it loads — this
    // way any printer's own driver handles the actual printing, so it
    // works with the shop's USB thermal printer or any other model without
    // needing printer-specific label software.
    const win = window.open("", "_blank", "width=420,height=650");
    if (!win || !labelUrl) return;
    win.document.write(
      `<!DOCTYPE html><html><head><title>Shipping label${
        trackingNumber ? ` — ${trackingNumber}` : ""
      }</title><style>@page{size:4in 6in;margin:0;}html,body{margin:0;padding:0;}img{width:4in;height:6in;display:block;}</style></head><body><img src="${labelUrl}" onload="window.focus();window.print();" /></body></html>`
    );
    win.document.close();
  }

  return (
    <div>
      {trackingNumber && (
        <p className="text-xs text-stone">
          Tracking: {trackingNumber}
          {carrierLabel ? ` (${carrierLabel})` : ""}
        </p>
      )}
      {labelUrl &&
        (isImage ? (
          <div className="mt-2">
            <img src={labelUrl} alt="Shipping label" className="border hairline w-32 mb-2" />
            <div>
              <button type="button" onClick={handlePrint} className="btn-secondary !px-4 !py-2 text-xs">
                Print label
              </button>
            </div>
          </div>
        ) : (
          <a href={labelUrl} target="_blank" rel="noreferrer" className="text-xs underline hover:text-ink mt-1 inline-block">
            Open label
          </a>
        ))}
    </div>
  );
}

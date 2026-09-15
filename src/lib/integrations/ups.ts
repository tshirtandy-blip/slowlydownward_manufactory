/**
 * UPS API — OAuth2 client-credentials flow + Shipping API.
 * Register an app at https://developer.ups.com to get a client id/secret,
 * plus a shipper account number from your UPS account.
 *
 * NOTE: UPS revises its Shipping API path version periodically
 * (e.g. /api/shipments/v2409/ship). Check developer.ups.com's current
 * "Shipping" API reference before going live and update UPS_API_VERSION
 * below if needed.
 *
 * Docs: https://developer.ups.com/api/reference?loc=en_US
 */

const UPS_API_VERSION = "v2409";

function baseUrl() {
  return process.env.UPS_ENV === "production"
    ? "https://onlinetools.ups.com"
    : "https://wwwcie.ups.com"; // sandbox
}

export function upsConfigured() {
  return !!process.env.UPS_CLIENT_ID && !!process.env.UPS_CLIENT_SECRET && !!process.env.UPS_ACCOUNT_NUMBER;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;

  const res = await fetch(`${baseUrl()}/security/v1/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.UPS_CLIENT_ID}:${process.env.UPS_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`UPS OAuth failed: ${await res.text()}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in) * 1000 };
  return cachedToken.token;
}

export type ShippingAddress = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode: string;
  countryCode: string; // ISO-2
  phone?: string;
};

export type PackageDetails = {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type CustomsItem = {
  description: string;
  hsCode: string;
  quantity: number;
  unitValueMinor: number;
  totalValueMinor: number;
  originCountryCode: string;
};

export type CreatedLabel = {
  trackingNumber: string;
  labelUrl?: string;
  labelBase64?: string;
  /** The image format labelBase64 is encoded in — only meaningful when
   * labelBase64 is set (Royal Mail returns a hosted labelUrl instead, never
   * this). UPS labels are requested as GIF (see createUpsShipment) since a
   * plain raster image prints correctly through any printer's normal OS
   * driver — including a USB thermal label printer — with no need for a
   * printer-specific command language like ZPL/EPL. */
  labelFormat?: "GIF" | "PDF";
  carrier: "UPS" | "ROYAL_MAIL";
};

/** Dimensions + weight shared between the Shipping and Rating APIs — each
 * API names the packaging-type field differently ("Packaging" vs
 * "PackagingType"), so callers add that key themselves alongside this. */
function packageBlock(pkg: PackageDetails) {
  return {
    Dimensions: {
      UnitOfMeasurement: { Code: "CM" },
      Length: String(Math.max(1, Math.round(pkg.lengthCm))),
      Width: String(Math.max(1, Math.round(pkg.widthCm))),
      Height: String(Math.max(1, Math.round(pkg.heightCm))),
    },
    PackageWeight: {
      UnitOfMeasurement: { Code: "KGS" },
      Weight: Math.max(0.1, pkg.weightGrams / 1000).toFixed(2),
    },
  };
}

/**
 * Registers a document (e.g. a commercial invoice PDF) with UPS's Paperless
 * Documents API and returns the DocumentID to reference on the shipment
 * request below — this is what lets an international shipment go out
 * without a printed invoice physically inside the parcel ("paperless"
 * customs). Requires the shipper account to be enrolled in the Paperless
 * Invoice program via UPS (ask your UPS account rep if uploads are refused).
 *
 * NOTE: verify the current Paperless Documents API path/payload shape
 * against developer.ups.com before relying on this — like the other UPS
 * endpoints here, UPS has changed these before.
 */
export async function uploadPaperlessInvoice(params: {
  pdfBase64: string;
  reference: string;
}): Promise<string> {
  const token = await getAccessToken();

  const payload = {
    UploadRequest: {
      ShipperNumber: process.env.UPS_ACCOUNT_NUMBER,
      UserCreatedForm: {
        UserCreatedFormFileName: `${params.reference}-commercial-invoice.pdf`,
        UserCreatedFormFileFormat: "pdf",
        UserCreatedFormDocumentType: "013", // Commercial Invoice
        UserCreatedFormFile: params.pdfBase64,
      },
    },
  };

  const res = await fetch(`${baseUrl()}/api/paperlessdocuments/v1/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      transId: crypto.randomUUID(),
      transactionSrc: "slowlydownward",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`UPS paperless invoice upload failed: ${await res.text()}`);
  const data = await res.json();
  const documentId = data.UploadResponse?.FormsHistoryDocumentID?.DocumentID;
  if (!documentId) throw new Error("UPS paperless invoice upload didn't return a document id.");
  return documentId;
}

/**
 * Creates a shipment + label for one order. Package weight/dimensions come
 * from the ordered print(s) — see src/lib/customs.ts — falling back to
 * generic placeholders for anything not yet filled in on the product page.
 *
 * For a shipment leaving the UK, pass `customs` + `invoiceDocumentId` (from
 * uploadPaperlessInvoice above) so UPS's international customs forms are
 * attached electronically rather than needing a printed invoice in the
 * parcel. Omit both for a UK domestic shipment, which needs neither.
 *
 * Every UPS label — domestic or international — requests a signature on
 * delivery (DeliveryConfirmation DCISType "1"), store policy for every UPS
 * parcel regardless of value or destination, and is sized/formatted for a
 * 4x6" thermal label (LabelStockSize + GIF image format) rather than a
 * full sheet — see the LabelSpecification note on labelFormat above for
 * why GIF specifically.
 */
export async function createUpsShipment(params: {
  shipTo: ShippingAddress;
  reference: string; // e.g. order number
  package: PackageDetails;
  customs?: { items: CustomsItem[]; invoiceDocumentId?: string };
}): Promise<CreatedLabel> {
  const token = await getAccessToken();

  const shipment: any = {
    Description: "Limited edition art print",
    Shipper: {
      Name: "Slowly Downward",
      ShipperNumber: process.env.UPS_ACCOUNT_NUMBER,
    },
    ShipTo: {
      Name: params.shipTo.name,
      Address: {
        AddressLine: [params.shipTo.line1, params.shipTo.line2].filter(Boolean),
        City: params.shipTo.city,
        PostalCode: params.shipTo.postalCode,
        CountryCode: params.shipTo.countryCode,
      },
    },
    ReferenceNumber: [{ Value: params.reference }],
    Package: [{ Packaging: { Code: "02" }, ...packageBlock(params.package) }],
    // Signature required on delivery, every UPS parcel — company policy
    // regardless of destination or value. DCISType "1" is plain signature
    // required (as opposed to "2", adult signature required, which this
    // store doesn't need).
    ShipmentServiceOptions: {
      DeliveryConfirmation: { DCISType: "1" },
    },
    // UPS rejects a shipment with no billing option at all (error 120416,
    // "A single billing option is required per shipment") — this bills
    // transportation to the same account the shipment is created under
    // (must match Shipper.ShipperNumber above), i.e. the shop pays UPS
    // directly rather than the recipient or a third party.
    PaymentInformation: {
      ShipmentCharge: [
        {
          Type: { Code: "01", Description: "Transportation" },
          BillShipper: { AccountNumber: process.env.UPS_ACCOUNT_NUMBER },
        },
      ],
    },
  };

  if (params.customs) {
    shipment.ShipmentServiceOptions.InternationalForms = {
      FormType: "01", // Invoice
      InvoiceNumber: params.reference,
      InvoiceDate: new Date().toISOString().slice(0, 10).replace(/-/g, ""),
      ReasonForExport: "SALE",
      CurrencyCode: "GBP",
      Product: params.customs.items.map((item) => ({
        Description: item.description,
        CommodityCode: item.hsCode,
        OriginCountryCode: item.originCountryCode,
        Unit: {
          Number: String(item.quantity),
          UnitOfMeasurement: { Code: "PCS" },
          Value: (item.unitValueMinor / 100).toFixed(2),
        },
      })),
      // Referencing an already-uploaded invoice (see uploadPaperlessInvoice)
      // is what makes this "paperless" — no printed copy needs to travel
      // with the parcel. Falls back to letting UPS generate its own basic
      // form from the data above if no document was uploaded.
      ...(params.customs.invoiceDocumentId
        ? {
            AdditionalDocumentIndicator: "1",
            FormsHistoryDocumentID: params.customs.invoiceDocumentId,
          }
        : {}),
    };
  }

  const payload = {
    ShipmentRequest: {
      Shipment: shipment,
      // GIF at 4x6" — a plain raster image that prints correctly through
      // any printer's normal OS driver (a USB thermal label printer
      // included), rather than a thermal-specific command language like
      // ZPL/EPL that not every printer model understands the same way.
      // UPS only ever scales an image DOWN to fit LabelStockSize, never up,
      // so this is the actual printed size, not just a hint.
      LabelSpecification: {
        LabelImageFormat: { Code: "GIF" },
        LabelStockSize: { Height: "6", Width: "4" },
      },
    },
  };

  const res = await fetch(`${baseUrl()}/api/shipments/${UPS_API_VERSION}/ship`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      transId: crypto.randomUUID(),
      transactionSrc: "slowlydownward",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`UPS shipment creation failed: ${await res.text()}`);
  const data = await res.json();
  const result = data.ShipmentResponse.ShipmentResults;

  return {
    trackingNumber: result.ShipmentIdentificationNumber,
    labelBase64: result.PackageResults?.[0]?.ShippingLabel?.GraphicImage,
    labelFormat: "GIF" as const,
    carrier: "UPS" as const,
  };
}

export type RateQuote = { amountMinor: number; currency: string; service: string };

/**
 * Live rate quote via UPS's Rating API (a separate endpoint from Shipping
 * above) — "Shop" asks for every service UPS will offer between the two
 * addresses, and this returns the cheapest one found. Used on the packing
 * tab so a packer can see what UPS would actually cost before choosing it.
 *
 * NOTE: verify the current Rating API path/payload shape against
 * developer.ups.com before going live, same as the Shipping API above.
 */
export async function getUpsRate(params: {
  shipTo: ShippingAddress;
  shipFrom: ShippingAddress;
  package: PackageDetails;
}): Promise<RateQuote> {
  const token = await getAccessToken();

  const addressBlock = (a: ShippingAddress) => ({
    Name: a.name,
    Address: {
      AddressLine: [a.line1, a.line2].filter(Boolean),
      City: a.city,
      PostalCode: a.postalCode,
      CountryCode: a.countryCode,
    },
  });

  const payload = {
    RateRequest: {
      Request: { RequestOption: "Shop" },
      Shipment: {
        Shipper: { ...addressBlock(params.shipFrom), ShipperNumber: process.env.UPS_ACCOUNT_NUMBER },
        ShipFrom: addressBlock(params.shipFrom),
        ShipTo: addressBlock(params.shipTo),
        Package: [{ PackagingType: { Code: "02" }, ...packageBlock(params.package) }],
        // Without this, UPS's Rating API returns its standard PUBLISHED
        // (retail list) rates — not the discounted rates actually negotiated
        // on your account — even though the request is authenticated with
        // your account number. This is what asks for the real, discounted
        // figure instead. If your account's negotiated rates aren't
        // returned via the API for some reason, UPS falls back to the
        // published rate silently, so if numbers still look too high after
        // this change, ask your UPS account rep to confirm "negotiated
        // rates via API" is switched on for your account.
        ShipmentRatingOptions: { NegotiatedRatesIndicator: "Y" },
      },
    },
  };

  const res = await fetch(`${baseUrl()}/api/rating/${UPS_API_VERSION}/Shop`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      transId: crypto.randomUUID(),
      transactionSrc: "slowlydownward",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`UPS rate lookup failed: ${await res.text()}`);
  const data = await res.json();
  const rated = data.RateResponse?.RatedShipment;
  const options = Array.isArray(rated) ? rated : rated ? [rated] : [];
  if (options.length === 0) throw new Error("UPS returned no rate options for this address.");

  // Prefer the negotiated (discounted) charge when UPS returns one for a
  // given service — it lives in a separate node from the published rate,
  // oddly under a singular "TotalCharge" rather than "TotalCharges". Falls
  // back to the published rate for any service where a negotiated figure
  // isn't present.
  const amountFor = (o: any) => Number(o.NegotiatedRateCharges?.TotalCharge?.MonetaryValue ?? o.TotalCharges.MonetaryValue);

  const cheapest = options.reduce((min: any, o: any) => (amountFor(o) < amountFor(min) ? o : min));

  return {
    amountMinor: Math.round(amountFor(cheapest) * 100),
    currency: cheapest.NegotiatedRateCharges?.TotalCharge?.CurrencyCode ?? cheapest.TotalCharges.CurrencyCode ?? "GBP",
    service: cheapest.Service?.Description ?? `Service ${cheapest.Service?.Code ?? ""}`.trim(),
  };
}

export type TrackingEvent = { status: string; description: string; occurredAt?: string };

/**
 * Live tracking lookup via UPS's Track API. Returns the carrier's own
 * current status string (e.g. "In Transit", "Delivered") — shown as-is on
 * the order detail page rather than mapped to our own vocabulary, since
 * UPS's own wording is exactly what's useful to relay to a customer.
 *
 * NOTE: verify the current Track API path against developer.ups.com.
 */
export async function getUpsTracking(trackingNumber: string): Promise<TrackingEvent> {
  const token = await getAccessToken();
  const res = await fetch(`${baseUrl()}/api/track/v1/details/${encodeURIComponent(trackingNumber)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      transId: crypto.randomUUID(),
      transactionSrc: "slowlydownward",
    },
  });
  if (!res.ok) throw new Error(`UPS tracking lookup failed: ${await res.text()}`);
  const data = await res.json();
  const activity = data.trackResponse?.shipment?.[0]?.package?.[0]?.activity?.[0];
  const status = activity?.status?.description ?? "Unknown";
  return { status, description: status, occurredAt: activity?.date };
}

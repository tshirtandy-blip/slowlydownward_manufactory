import { prisma } from "@/lib/prisma";

export const SHIPPING_ZONE_KEYS = ["UK", "EUROPE", "ROW"] as const;
export type ShippingZoneKey = (typeof SHIPPING_ZONE_KEYS)[number];

export type ShippingZoneRow = {
  id: string;
  key: string;
  label: string;
  priceMinor: number;
  countryCodes: string[];
  sortOrder: number;
};

// Seeded the first time Admin > Settings > Shipping (or checkout) is
// visited. Andrew's stated starting rates: £15 UK, £25 Europe, £35 rest of
// world — all fully editable afterwards, including which countries sit in
// which zone.
const DEFAULTS: Record<ShippingZoneKey, { label: string; priceMinor: number; countryCodes: string[]; sortOrder: number }> = {
  UK: {
    label: "United Kingdom",
    priceMinor: 1500,
    countryCodes: ["GB"],
    sortOrder: 0,
  },
  EUROPE: {
    label: "Europe",
    priceMinor: 2500,
    countryCodes: [
      "IE", "FR", "DE", "NL", "BE", "LU", "ES", "PT", "IT", "AT", "CH",
      "DK", "SE", "NO", "FI", "PL", "CZ", "SK", "HU", "GR", "RO", "BG",
      "HR", "SI", "EE", "LV", "LT", "MT", "CY", "IS",
    ],
    sortOrder: 1,
  },
  ROW: {
    label: "Rest of world",
    priceMinor: 3500,
    countryCodes: ["US", "CA", "AU", "NZ", "JP", "SG", "HK", "AE", "ZA", "BR", "MX", "KR", "CN", "IN"],
    sortOrder: 2,
  },
};

/** Fetches the 3 shipping zones, creating them with the defaults above the
 * first time this is ever called (e.g. right after this feature is
 * installed, before the admin has visited the settings page). */
export async function getShippingZones(): Promise<ShippingZoneRow[]> {
  const zones = await Promise.all(
    SHIPPING_ZONE_KEYS.map((key) =>
      prisma.shippingZone.upsert({
        where: { key },
        update: {},
        create: { key, ...DEFAULTS[key] },
      })
    )
  );
  return zones
    .map((z) => ({ ...z, countryCodes: (z.countryCodes as string[]) ?? [] }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Which zone (if any) covers a given ISO 3166-1 alpha-2 country code. */
export function zoneForCountry(zones: ShippingZoneRow[], countryCode: string): ShippingZoneRow | null {
  const code = countryCode.toUpperCase();
  return zones.find((z) => z.countryCodes.includes(code)) ?? null;
}

/** Every country code assigned to any zone — i.e. everywhere the store
 * currently ships. Used to restrict both the checkout "ship to" picker and
 * Stripe's own address form to places we actually deliver. */
export function allShippableCountryCodes(zones: ShippingZoneRow[]): string[] {
  return zones.flatMap((z) => z.countryCodes);
}

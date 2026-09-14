import type { ShippingAddress } from "@/lib/integrations/ups";

/** Where parcels ship FROM — needed for a UPS rate quote (it rates between
 * two addresses) as well as for shipment/label creation. Read from env vars
 * rather than the database, consistent with how carrier credentials are
 * stored elsewhere in this app. */
export function storeAddressConfigured(): boolean {
  return !!(
    process.env.STORE_ADDRESS_LINE1 &&
    process.env.STORE_ADDRESS_CITY &&
    process.env.STORE_ADDRESS_POSTAL_CODE &&
    process.env.STORE_ADDRESS_COUNTRY
  );
}

export function getStoreAddress(): ShippingAddress {
  return {
    name: process.env.STORE_ADDRESS_NAME || "Slowly Downward",
    line1: process.env.STORE_ADDRESS_LINE1 || "",
    line2: process.env.STORE_ADDRESS_LINE2 || undefined,
    city: process.env.STORE_ADDRESS_CITY || "",
    postalCode: process.env.STORE_ADDRESS_POSTAL_CODE || "",
    countryCode: process.env.STORE_ADDRESS_COUNTRY || "GB",
  };
}
